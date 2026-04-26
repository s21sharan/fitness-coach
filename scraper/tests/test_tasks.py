"""Tests for scraper/tasks/papers.py — helper functions and Celery task logic."""

from __future__ import annotations

import json
import unittest
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# search_pmc
# ---------------------------------------------------------------------------

class TestSearchPmc:
    def test_search_pmc_returns_ids(self):
        """search_pmc returns the idlist from esearch JSON response."""
        from scraper.tasks.papers import search_pmc

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "esearchresult": {
                "idlist": ["12345678", "87654321", "11111111"]
            }
        }

        with patch("requests.get", return_value=mock_resp) as mock_get, \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = search_pmc("muscle hypertrophy", max_results=3)

            assert result == ["12345678", "87654321", "11111111"]
            mock_get.assert_called_once()
            call_kwargs = mock_get.call_args
            # Verify correct endpoint was used
            assert "esearch.fcgi" in call_kwargs[0][0]

    def test_search_pmc_passes_correct_params(self):
        """search_pmc passes db=pmc, retmode=json, and the query term."""
        from scraper.tasks.papers import search_pmc

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"esearchresult": {"idlist": []}}

        with patch("requests.get", return_value=mock_resp) as mock_get, \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            search_pmc("creatine performance", max_results=50)

            call_kwargs = mock_get.call_args[1]
            params = call_kwargs.get("params", {})
            assert params.get("db") == "pmc"
            assert params.get("retmode") == "json"
            assert params.get("term") == "creatine performance"
            assert params.get("retmax") == 50

    def test_search_pmc_returns_empty_list_on_no_results(self):
        """search_pmc returns empty list when idlist is empty."""
        from scraper.tasks.papers import search_pmc

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"esearchresult": {"idlist": []}}

        with patch("requests.get", return_value=mock_resp), \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = search_pmc("nonexistent query xyz")
            assert result == []

    def test_search_pmc_calls_rate_limiter(self):
        """search_pmc calls rate limiter before making the request."""
        from scraper.tasks.papers import search_pmc

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"esearchresult": {"idlist": []}}

        with patch("requests.get", return_value=mock_resp), \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_wait = MagicMock()
            mock_limiter.return_value.wait = mock_wait

            search_pmc("test query")

            mock_limiter.assert_called_once_with("pmc")
            mock_wait.assert_called_once()


# ---------------------------------------------------------------------------
# fetch_pmc_fulltext
# ---------------------------------------------------------------------------

class TestFetchPmcFulltext:
    def test_fetch_pmc_fulltext_returns_body_text(self):
        """fetch_pmc_fulltext parses XML and returns body text."""
        from scraper.tasks.papers import fetch_pmc_fulltext

        xml_content = b"""<?xml version="1.0"?>
        <root>
            <body>This is the body text of the paper with important findings.</body>
        </root>"""

        mock_resp = MagicMock()
        mock_resp.content = xml_content

        with patch("requests.get", return_value=mock_resp) as mock_get, \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = fetch_pmc_fulltext("PMC12345")

            assert result is not None
            assert "body text" in result or "important findings" in result

    def test_fetch_pmc_fulltext_strips_pmc_prefix(self):
        """fetch_pmc_fulltext strips the PMC prefix before calling API."""
        from scraper.tasks.papers import fetch_pmc_fulltext

        xml_content = b"""<?xml version="1.0"?>
        <root><body>Some text</body></root>"""

        mock_resp = MagicMock()
        mock_resp.content = xml_content

        with patch("requests.get", return_value=mock_resp) as mock_get, \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            fetch_pmc_fulltext("PMC99999")

            call_kwargs = mock_get.call_args[1]
            params = call_kwargs.get("params", {})
            assert params.get("id") == "99999"

    def test_fetch_pmc_fulltext_returns_none_when_no_body(self):
        """fetch_pmc_fulltext returns None when XML has no body element."""
        from scraper.tasks.papers import fetch_pmc_fulltext

        xml_content = b"""<?xml version="1.0"?>
        <root><abstract>No body here</abstract></root>"""

        mock_resp = MagicMock()
        mock_resp.content = xml_content

        with patch("requests.get", return_value=mock_resp), \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = fetch_pmc_fulltext("PMC00000")
            assert result is None

    def test_fetch_pmc_fulltext_calls_efetch_endpoint(self):
        """fetch_pmc_fulltext calls the efetch endpoint."""
        from scraper.tasks.papers import fetch_pmc_fulltext

        xml_content = b"""<?xml version="1.0"?><root><body>text</body></root>"""
        mock_resp = MagicMock()
        mock_resp.content = xml_content

        with patch("requests.get", return_value=mock_resp) as mock_get, \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            fetch_pmc_fulltext("PMC123")

            url = mock_get.call_args[0][0]
            assert "efetch.fcgi" in url


# ---------------------------------------------------------------------------
# fetch_pmc_metadata
# ---------------------------------------------------------------------------

class TestFetchPmcMetadata:
    def test_fetch_pmc_metadata_returns_dict(self):
        """fetch_pmc_metadata returns a dict with expected keys."""
        from scraper.tasks.papers import fetch_pmc_metadata

        xml_content = b"""<?xml version="1.0"?>
        <eSummaryResult>
            <DocSum>
                <Item Name="Title" Type="String">Effects of Creatine</Item>
                <Item Name="Source" Type="String">Journal of Sports Science</Item>
                <Item Name="PubDate" Type="String">2022 Jan</Item>
                <Item Name="AuthorList" Type="List">
                    <Item Name="Author" Type="String">Smith J</Item>
                    <Item Name="Author" Type="String">Jones K</Item>
                </Item>
                <Item Name="DOI" Type="String">10.1000/xyz123</Item>
            </DocSum>
        </eSummaryResult>"""

        mock_resp = MagicMock()
        mock_resp.content = xml_content

        with patch("requests.get", return_value=mock_resp), \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = fetch_pmc_metadata("PMC12345")

            assert isinstance(result, dict)
            assert "Title" in result
            assert result["Title"] == "Effects of Creatine"

    def test_fetch_pmc_metadata_calls_esummary(self):
        """fetch_pmc_metadata calls the esummary endpoint."""
        from scraper.tasks.papers import fetch_pmc_metadata

        xml_content = b"""<?xml version="1.0"?><eSummaryResult><DocSum></DocSum></eSummaryResult>"""
        mock_resp = MagicMock()
        mock_resp.content = xml_content

        with patch("requests.get", return_value=mock_resp) as mock_get, \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            fetch_pmc_metadata("PMC12345")

            url = mock_get.call_args[0][0]
            assert "esummary.fcgi" in url


# ---------------------------------------------------------------------------
# fetch_scihub_pdf
# ---------------------------------------------------------------------------

class TestFetchScihubPdf:
    def test_fetch_scihub_pdf_returns_bytes_from_iframe(self):
        """fetch_scihub_pdf parses iframe src and downloads PDF bytes."""
        from scraper.tasks.papers import fetch_scihub_pdf

        html_page = b"""<html><body>
        <div id="viewer">
            <iframe src="https://cdn.sci-hub.se/downloads/paper.pdf"></iframe>
        </div>
        </body></html>"""

        pdf_bytes = b"%PDF-1.4 fake pdf content"

        page_resp = MagicMock()
        page_resp.status_code = 200
        page_resp.content = html_page
        page_resp.url = "https://sci-hub.se/10.1000/test"

        pdf_resp = MagicMock()
        pdf_resp.status_code = 200
        pdf_resp.content = pdf_bytes

        with patch("requests.get", side_effect=[page_resp, pdf_resp]), \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = fetch_scihub_pdf("10.1000/test")

            assert result == pdf_bytes

    def test_fetch_scihub_pdf_handles_protocol_relative_url(self):
        """fetch_scihub_pdf resolves protocol-relative URLs (// prefix)."""
        from scraper.tasks.papers import fetch_scihub_pdf

        html_page = b"""<html><body>
        <div id="viewer">
            <iframe src="//cdn.sci-hub.se/downloads/paper.pdf"></iframe>
        </div>
        </body></html>"""

        pdf_bytes = b"%PDF-1.4 content"

        page_resp = MagicMock()
        page_resp.status_code = 200
        page_resp.content = html_page
        page_resp.url = "https://sci-hub.se/10.1000/test"

        pdf_resp = MagicMock()
        pdf_resp.status_code = 200
        pdf_resp.content = pdf_bytes

        with patch("requests.get", side_effect=[page_resp, pdf_resp]) as mock_get, \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = fetch_scihub_pdf("10.1000/test")

            # Second call should use https:// not //
            second_call_url = mock_get.call_args_list[1][0][0]
            assert second_call_url.startswith("https://")
            assert result == pdf_bytes

    def test_fetch_scihub_pdf_returns_none_when_no_pdf_found(self):
        """fetch_scihub_pdf returns None when no PDF URL found in page."""
        from scraper.tasks.papers import fetch_scihub_pdf

        html_page = b"""<html><body><p>Paper not found</p></body></html>"""

        page_resp = MagicMock()
        page_resp.status_code = 200
        page_resp.content = html_page
        page_resp.url = "https://sci-hub.se/10.1000/notfound"

        with patch("requests.get", return_value=page_resp), \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = fetch_scihub_pdf("10.1000/notfound")
            assert result is None

    def test_fetch_scihub_pdf_tries_multiple_mirrors(self):
        """fetch_scihub_pdf tries the next mirror if the first fails."""
        from scraper.tasks.papers import fetch_scihub_pdf
        from scraper.config import SCIHUB_MIRRORS

        html_page = b"""<html><body>
        <div id="viewer">
            <iframe src="https://cdn.sci-hub.se/paper.pdf"></iframe>
        </div>
        </body></html>"""
        pdf_bytes = b"%PDF content"

        def side_effect(url, **kwargs):
            # First mirror fails, second succeeds with page, third PDF download
            if SCIHUB_MIRRORS[0] in url and "cdn" not in url:
                raise Exception("Connection refused")
            resp = MagicMock()
            resp.status_code = 200
            if "cdn" in url:
                resp.content = pdf_bytes
            else:
                resp.content = html_page
                resp.url = url
            return resp

        with patch("requests.get", side_effect=side_effect), \
             patch("scraper.tasks.papers.get_limiter") as mock_limiter:
            mock_limiter.return_value.wait = MagicMock()

            result = fetch_scihub_pdf("10.1000/test")
            assert result == pdf_bytes


# ---------------------------------------------------------------------------
# search_biorxiv
# ---------------------------------------------------------------------------

class TestSearchBiorxiv:
    def test_search_biorxiv_returns_collection(self):
        """search_biorxiv returns the collection list from API response."""
        from scraper.tasks.papers import search_biorxiv

        collection = [
            {"doi": "10.1101/2022.01.01.01", "title": "Creatine study"},
            {"doi": "10.1101/2022.01.02.01", "title": "Protein timing study"},
        ]
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"collection": collection}

        with patch("requests.get", return_value=mock_resp):
            result = search_biorxiv("creatine", "2022-01-01", "2022-01-31")

            assert result == collection

    def test_search_biorxiv_calls_correct_endpoint(self):
        """search_biorxiv calls the biorxiv API with dates in the URL."""
        from scraper.tasks.papers import search_biorxiv

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"collection": []}

        with patch("requests.get", return_value=mock_resp) as mock_get:
            search_biorxiv("protein", "2023-01-01", "2023-01-31")

            url = mock_get.call_args[0][0]
            assert "2023-01-01" in url
            assert "2023-01-31" in url
            assert "biorxiv" in url.lower() or "api.biorxiv.org" in url

    def test_search_biorxiv_returns_empty_list_on_no_results(self):
        """search_biorxiv returns empty list when collection is empty."""
        from scraper.tasks.papers import search_biorxiv

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"collection": []}

        with patch("requests.get", return_value=mock_resp):
            result = search_biorxiv("nonexistent", "2023-01-01", "2023-01-31")
            assert result == []

    def test_search_biorxiv_uses_server_param(self):
        """search_biorxiv uses the server param in the API URL."""
        from scraper.tasks.papers import search_biorxiv

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"collection": []}

        with patch("requests.get", return_value=mock_resp) as mock_get:
            search_biorxiv("test", "2023-01-01", "2023-01-31", server="medrxiv")

            url = mock_get.call_args[0][0]
            assert "medrxiv" in url


# ---------------------------------------------------------------------------
# fetch_paper Celery task
# ---------------------------------------------------------------------------

class TestFetchPaperTask:
    def test_fetch_paper_deduplicates_by_doi(self):
        """fetch_paper returns 'duplicate' status when DOI already exists."""
        from scraper.tasks.papers import fetch_paper

        mock_db = MagicMock()
        mock_db.hash_exists.return_value = True

        with patch("scraper.tasks.papers.Database", return_value=mock_db), \
             patch("scraper.tasks.papers.fetch_pmc_fulltext", return_value="full text"), \
             patch("scraper.tasks.papers.fetch_scihub_pdf", return_value=None):

            result = fetch_paper(
                doi="10.1000/xyz",
                pmcid="PMC12345",
                title="Test Paper",
                authors="Smith J",
                source_platform="pmc",
                session_id=1,
                api_key="",
                email="test@test.com",
            )

            assert result["status"] == "duplicate"

    def test_fetch_paper_inserts_content_on_success(self):
        """fetch_paper calls db.insert_content when full text is found."""
        from scraper.tasks.papers import fetch_paper

        mock_db = MagicMock()
        mock_db.hash_exists.return_value = False
        mock_db.insert_content.return_value = 42

        with patch("scraper.tasks.papers.Database", return_value=mock_db), \
             patch("scraper.tasks.papers.fetch_pmc_fulltext", return_value="full paper text here"), \
             patch("scraper.tasks.papers.classify", return_value="hypertrophy"), \
             patch("scraper.tasks.papers.get_subcategories", return_value=["volume"]), \
             patch("scraper.tasks.papers.detect_paper_type", return_value="research_paper"), \
             patch("scraper.tasks.papers.score_paper", return_value=5.0):

            result = fetch_paper(
                doi="10.1000/xyz",
                pmcid="PMC12345",
                title="Test Paper",
                authors="Smith J",
                source_platform="pmc",
                session_id=1,
                api_key="",
                email="test@test.com",
            )

            assert result["status"] == "saved"
            mock_db.insert_content.assert_called_once()

    def test_fetch_paper_falls_back_to_scihub(self):
        """fetch_paper tries Sci-Hub when PMC full text is unavailable."""
        from scraper.tasks.papers import fetch_paper

        pdf_bytes = b"%PDF-1.4 research paper content"

        mock_db = MagicMock()
        mock_db.hash_exists.return_value = False
        mock_db.insert_content.return_value = 1

        with patch("scraper.tasks.papers.Database", return_value=mock_db), \
             patch("scraper.tasks.papers.fetch_pmc_fulltext", return_value=None), \
             patch("scraper.tasks.papers.fetch_scihub_pdf", return_value=pdf_bytes) as mock_scihub, \
             patch("scraper.tasks.papers.extract_text_from_bytes", return_value="extracted text"), \
             patch("scraper.tasks.papers.classify", return_value="supplements"), \
             patch("scraper.tasks.papers.get_subcategories", return_value=[]), \
             patch("scraper.tasks.papers.detect_paper_type", return_value="research_paper"), \
             patch("scraper.tasks.papers.score_paper", return_value=3.0):

            result = fetch_paper(
                doi="10.1000/xyz",
                pmcid=None,
                title="Test Paper",
                authors="Smith J",
                source_platform="pmc",
                session_id=1,
                api_key="",
                email="test@test.com",
            )

            mock_scihub.assert_called_once_with("10.1000/xyz")
            assert result["status"] == "saved"

    def test_fetch_paper_logs_failure_when_no_text(self):
        """fetch_paper logs a failed fetch when neither PMC nor Sci-Hub yields text."""
        from scraper.tasks.papers import fetch_paper

        mock_db = MagicMock()
        mock_db.hash_exists.return_value = False

        with patch("scraper.tasks.papers.Database", return_value=mock_db), \
             patch("scraper.tasks.papers.fetch_pmc_fulltext", return_value=None), \
             patch("scraper.tasks.papers.fetch_scihub_pdf", return_value=None):

            result = fetch_paper(
                doi="10.1000/xyz",
                pmcid=None,
                title="Test Paper",
                authors="Smith J",
                source_platform="pmc",
                session_id=1,
                api_key="",
                email="test@test.com",
            )

            mock_db.log_failed_fetch.assert_called_once()
            assert result["status"] == "failed"


# ---------------------------------------------------------------------------
# search_and_fetch_papers Celery task
# ---------------------------------------------------------------------------

class TestSearchAndFetchPapersTask:
    def test_search_and_fetch_papers_enqueues_fetch_tasks(self):
        """search_and_fetch_papers enqueues fetch_paper.delay for each result."""
        from scraper.tasks.papers import search_and_fetch_papers

        pmc_ids = ["PMC111", "PMC222"]

        mock_db = MagicMock()
        mock_db.get_session_status.return_value = "running"
        mock_db.update_search_task = MagicMock()

        with patch("scraper.tasks.papers.Database", return_value=mock_db), \
             patch("scraper.tasks.papers.search_pmc", return_value=pmc_ids), \
             patch("scraper.tasks.papers.fetch_pmc_metadata", return_value={
                 "Title": "Test", "AuthorList": "Smith J", "Source": "J Sport Sci",
                 "PubDate": "2022", "DOI": "10.1000/test"
             }), \
             patch("scraper.tasks.papers.fetch_paper") as mock_fetch_paper:

            mock_fetch_paper.delay = MagicMock()

            search_and_fetch_papers(
                search_term="creatine",
                session_id=1,
                task_id=10,
                source_platform="pmc",
                max_results=100,
                api_key="",
                email="test@test.com",
            )

            assert mock_fetch_paper.delay.call_count == len(pmc_ids)

    def test_search_and_fetch_papers_respects_pause(self):
        """search_and_fetch_papers returns early when session is paused."""
        from scraper.tasks.papers import search_and_fetch_papers

        mock_db = MagicMock()
        mock_db.get_session_status.return_value = "paused"

        with patch("scraper.tasks.papers.Database", return_value=mock_db), \
             patch("scraper.tasks.papers.search_pmc") as mock_search:

            result = search_and_fetch_papers(
                search_term="creatine",
                session_id=1,
                task_id=10,
                source_platform="pmc",
                max_results=100,
                api_key="",
                email="test@test.com",
            )

            mock_search.assert_not_called()
            assert result["status"] == "paused"

    def test_search_and_fetch_papers_uses_biorxiv_for_biorxiv_platform(self):
        """search_and_fetch_papers calls search_biorxiv when platform is biorxiv."""
        from scraper.tasks.papers import search_and_fetch_papers

        biorxiv_results = [
            {"doi": "10.1101/2022.01.01", "title": "Protein study", "authors": [{"name": "Smith J"}],
             "server": "biorxiv", "date": "2022-01-01"}
        ]

        mock_db = MagicMock()
        mock_db.get_session_status.return_value = "running"
        mock_db.update_search_task = MagicMock()

        with patch("scraper.tasks.papers.Database", return_value=mock_db), \
             patch("scraper.tasks.papers.search_biorxiv", return_value=biorxiv_results) as mock_bio, \
             patch("scraper.tasks.papers.search_pmc") as mock_pmc, \
             patch("scraper.tasks.papers.fetch_paper") as mock_fetch:

            mock_fetch.delay = MagicMock()

            search_and_fetch_papers(
                search_term="protein",
                session_id=1,
                task_id=10,
                source_platform="biorxiv",
                max_results=100,
                api_key="",
                email="test@test.com",
            )

            mock_bio.assert_called_once()
            mock_pmc.assert_not_called()
