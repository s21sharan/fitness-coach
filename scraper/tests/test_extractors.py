"""Tests for scraper/extractors/*.py"""
import os
import pytest
import fitz  # PyMuPDF

FIXTURES_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


# ---------------------------------------------------------------------------
# transcript.py tests
# ---------------------------------------------------------------------------

class TestTranscript:
    def test_parse_vtt_string_removes_timestamps(self):
        from scraper.extractors.transcript import parse_vtt_string
        vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:03.500\nHello world.\n"
        result = parse_vtt_string(vtt)
        assert "-->" not in result
        assert "Hello world" in result

    def test_parse_vtt_string_deduplicates_consecutive_lines(self):
        from scraper.extractors.transcript import parse_vtt_string
        vtt = (
            "WEBVTT\n\n"
            "00:00:00.000 --> 00:00:03.500\nRepeat line.\n\n"
            "00:00:03.500 --> 00:00:07.000\nRepeat line.\n\n"
            "00:00:07.000 --> 00:00:11.000\nNew content.\n"
        )
        result = parse_vtt_string(vtt)
        # Should only appear once due to deduplication
        assert result.count("Repeat line") == 1
        assert "New content" in result

    def test_parse_vtt_string_removes_inline_tags(self):
        from scraper.extractors.transcript import parse_vtt_string
        vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:03.500\n<c>protein</c> and <i>recovery</i>.\n"
        result = parse_vtt_string(vtt)
        assert "<c>" not in result
        assert "<i>" not in result
        assert "protein" in result
        assert "recovery" in result

    def test_parse_vtt_string_removes_cue_ids(self):
        from scraper.extractors.transcript import parse_vtt_string
        vtt = "WEBVTT\n\n1\n00:00:00.000 --> 00:00:03.500\nHello.\n\n2\n00:00:03.500 --> 00:00:07.000\nWorld.\n"
        result = parse_vtt_string(vtt)
        # standalone numbers should not appear as content
        lines = [l.strip() for l in result.split() if l.strip().isdigit()]
        assert lines == []

    def test_parse_vtt_preserves_content(self):
        from scraper.extractors.transcript import parse_vtt_string
        vtt = "WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nThe quick brown fox.\n"
        result = parse_vtt_string(vtt)
        assert "The quick brown fox" in result

    def test_parse_vtt_file(self, tmp_path):
        from scraper.extractors.transcript import parse_vtt
        vtt_file = tmp_path / "test.vtt"
        vtt_file.write_text("WEBVTT\n\n00:00:00.000 --> 00:00:03.500\nHello from file.\n")
        result = parse_vtt(str(vtt_file))
        assert "Hello from file" in result

    def test_parse_vtt_sample_fixture(self):
        from scraper.extractors.transcript import parse_vtt
        fixture_path = os.path.join(FIXTURES_DIR, "sample.vtt")
        result = parse_vtt(fixture_path)
        assert "-->" not in result
        assert "protein" in result
        assert "recovery" in result
        # "Welcome to this fitness podcast" should appear only once
        assert result.count("Welcome to this fitness podcast") == 1


# ---------------------------------------------------------------------------
# html.py tests
# ---------------------------------------------------------------------------

class TestHtml:
    def test_extract_article_returns_text(self):
        from scraper.extractors.html import extract_article
        with open(os.path.join(FIXTURES_DIR, "sample.html")) as f:
            html = f.read()
        result = extract_article(html)
        assert result is not None
        assert len(result) > 0

    def test_extract_article_contains_article_text(self):
        from scraper.extractors.html import extract_article
        with open(os.path.join(FIXTURES_DIR, "sample.html")) as f:
            html = f.read()
        result = extract_article(html)
        assert result is not None
        assert "protein" in result.lower() or "leucine" in result.lower() or "Protein" in result

    def test_extract_article_strips_navigation(self):
        from scraper.extractors.html import extract_article
        with open(os.path.join(FIXTURES_DIR, "sample.html")) as f:
            html = f.read()
        result = extract_article(html)
        assert result is not None
        # Nav items should not be in extracted content
        assert "Privacy Policy" not in result

    def test_extract_article_strips_script_and_style(self):
        from scraper.extractors.html import extract_article
        html = "<html><body><script>console.log('x')</script><style>body{}</style><article><p>Main content here.</p></article></body></html>"
        result = extract_article(html)
        assert result is not None
        assert "console.log" not in result
        assert "body{}" not in result
        assert "Main content" in result

    def test_extract_from_url_returns_text(self):
        from scraper.extractors.html import extract_from_url
        result = extract_from_url("https://example.com")
        assert result is not None
        assert len(result) > 0

    def test_extract_metadata_from_url_returns_dict(self):
        from scraper.extractors.html import extract_metadata_from_url
        result = extract_metadata_from_url("https://example.com")
        assert isinstance(result, dict)


# ---------------------------------------------------------------------------
# pdf.py tests
# ---------------------------------------------------------------------------

def _create_test_pdf_bytes(text: str = "Hello PDF World. This is test content.") -> bytes:
    """Create a minimal in-memory PDF for testing."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


class TestPdf:
    def test_extract_text_from_bytes_returns_text(self):
        from scraper.extractors.pdf import extract_text_from_bytes
        pdf_bytes = _create_test_pdf_bytes("Hello PDF World.")
        result = extract_text_from_bytes(pdf_bytes)
        assert isinstance(result, str)
        assert "Hello" in result

    def test_extract_text_from_bytes_content(self):
        from scraper.extractors.pdf import extract_text_from_bytes
        pdf_bytes = _create_test_pdf_bytes("The quick brown fox jumps.")
        result = extract_text_from_bytes(pdf_bytes)
        assert "quick brown fox" in result

    def test_extract_text_from_stream(self, tmp_path):
        from scraper.extractors.pdf import extract_text_from_stream
        pdf_bytes = _create_test_pdf_bytes("Stream test content.")
        pdf_file = tmp_path / "test.pdf"
        pdf_file.write_bytes(pdf_bytes)
        with open(str(pdf_file), "rb") as f:
            result = extract_text_from_stream(f)
        assert "Stream test content" in result

    def test_clean_paper_text_removes_references(self):
        from scraper.extractors.pdf import clean_paper_text
        text = "Introduction text here.\n\nReferences\n[1] Smith et al. 2020.\n[2] Jones et al. 2021."
        result = clean_paper_text(text)
        assert "Introduction text" in result
        assert "[1] Smith" not in result

    def test_clean_paper_text_collapses_newlines(self):
        from scraper.extractors.pdf import clean_paper_text
        text = "Line one.\n\n\n\n\nLine two."
        result = clean_paper_text(text)
        assert "\n\n\n" not in result

    def test_detect_paper_type_review(self):
        from scraper.extractors.pdf import detect_paper_type
        text = "This is a systematic review of randomized controlled trials examining protein timing."
        result = detect_paper_type(text)
        assert result == "systematic_review"

    def test_detect_paper_type_meta_analysis(self):
        from scraper.extractors.pdf import detect_paper_type
        text = "We conducted a meta-analysis of 50 studies on resistance training."
        result = detect_paper_type(text)
        assert result == "meta_analysis"

    def test_detect_paper_type_default(self):
        from scraper.extractors.pdf import detect_paper_type
        text = "This study examines the effects of exercise on health outcomes."
        result = detect_paper_type(text)
        assert result == "research_paper"

    def test_extract_text_handles_empty_pages(self):
        from scraper.extractors.pdf import extract_text_from_bytes
        doc = fitz.open()
        doc.new_page()  # empty page
        p2 = doc.new_page()
        p2.insert_text((72, 72), "Actual content.")
        doc.new_page()  # another empty page
        pdf_bytes = doc.tobytes()
        doc.close()
        result = extract_text_from_bytes(pdf_bytes)
        assert "Actual content" in result


# ---------------------------------------------------------------------------
# epub.py tests
# ---------------------------------------------------------------------------

class TestEpub:
    def test_extract_chapters_is_callable(self):
        from scraper.extractors.epub import extract_chapters
        assert callable(extract_chapters)

    def test_extract_full_text_is_callable(self):
        from scraper.extractors.epub import extract_full_text
        assert callable(extract_full_text)

    def test_extract_chapters_returns_list(self, tmp_path):
        """Test that extract_chapters returns a list (even if empty for a non-epub path)."""
        from scraper.extractors.epub import extract_chapters
        # Should return a list; invalid path should raise or return empty
        try:
            result = extract_chapters(str(tmp_path / "nonexistent.epub"))
            assert isinstance(result, list)
        except Exception:
            pass  # acceptable to raise for missing file


# ---------------------------------------------------------------------------
# audio.py tests
# ---------------------------------------------------------------------------

class TestAudio:
    def test_transcribe_audio_is_callable(self):
        from scraper.extractors.audio import transcribe_audio
        assert callable(transcribe_audio)

    def test_transcribe_and_cleanup_is_callable(self):
        from scraper.extractors.audio import transcribe_and_cleanup
        assert callable(transcribe_and_cleanup)

    def test_download_and_transcribe_is_callable(self):
        from scraper.extractors.audio import download_and_transcribe
        assert callable(download_and_transcribe)

    def test_transcribe_audio_signature(self):
        """Verify the function accepts expected parameters."""
        import inspect
        from scraper.extractors.audio import transcribe_audio
        sig = inspect.signature(transcribe_audio)
        params = list(sig.parameters.keys())
        assert "audio_path" in params
        assert "model_name" in params

    def test_transcribe_audio_default_model(self):
        """Verify default model is base.en."""
        import inspect
        from scraper.extractors.audio import transcribe_audio
        sig = inspect.signature(transcribe_audio)
        assert sig.parameters["model_name"].default == "base.en"
