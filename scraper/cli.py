import click
import time
import requests
from rich.console import Console
from rich.table import Table

console = Console()
API_BASE = "http://localhost:8000"


@click.group()
def cli():
    """Fitness Data Scraper CLI"""
    pass


@cli.command()
@click.option("--hours", default=12, type=float, help="Duration in hours")
@click.option("--sources", default="papers,youtube,articles,podcasts,books,reddit", help="Comma-separated sources")
def start(hours, sources):
    """Start a new scraping session."""
    payload = {
        "duration_hours": hours,
        "sources_enabled": sources.split(","),
    }
    try:
        resp = requests.post(f"{API_BASE}/scraper/start", json=payload, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        console.print(f"[bold green]Session #{data['session_id']} started[/bold green]")
        console.print(f"Duration: {hours}h | Sources: {sources}")
    except requests.ConnectionError:
        console.print("[bold red]Error:[/bold red] API server not running. Start it with: uvicorn scraper.api:app")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
def pause(session_id):
    """Pause the active scraping session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.post(f"{API_BASE}/scraper/pause", json={"session_id": session_id}, timeout=10)
    resp.raise_for_status()
    console.print(f"[bold yellow]Session #{session_id} paused[/bold yellow]")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
def resume(session_id):
    """Resume a paused scraping session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.post(f"{API_BASE}/scraper/resume", json={"session_id": session_id}, timeout=10)
    resp.raise_for_status()
    console.print(f"[bold green]Session #{session_id} resumed[/bold green]")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
def stop(session_id):
    """Stop the active scraping session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.post(f"{API_BASE}/scraper/stop", json={"session_id": session_id}, timeout=10)
    resp.raise_for_status()
    console.print(f"[bold red]Session #{session_id} stopped[/bold red]")


@cli.command()
@click.option("--session-id", type=int, default=None, help="Session ID (default: latest)")
@click.option("--watch", is_flag=True, help="Poll every 30 seconds")
def status(session_id, watch):
    """Show session status."""
    if session_id is None:
        session_id = _get_latest_session_id()

    if watch:
        while True:
            _print_status(session_id)
            time.sleep(30)
    else:
        _print_status(session_id)


@cli.command()
@click.option("--session-id", type=int, default=None)
def stats(session_id):
    """Show detailed stats for a session."""
    if session_id is None:
        session_id = _get_latest_session_id()
    _print_stats(session_id)


@cli.command()
@click.option("--session-id", type=int, default=None)
@click.option("--limit", default=20, type=int)
def errors(session_id, limit):
    """Show failed fetches."""
    if session_id is None:
        session_id = _get_latest_session_id()
    resp = requests.get(
        f"{API_BASE}/scraper/errors",
        params={"session_id": session_id, "limit": limit},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()

    if not data:
        console.print("[green]No errors![/green]")
        return

    table = Table(title=f"Errors — Session #{session_id}")
    table.add_column("Source")
    table.add_column("ID")
    table.add_column("Error")
    for err in data:
        table.add_row(err["source_type"], err["source_id"] or "", err["error_message"][:80])
    console.print(table)


def _get_latest_session_id() -> int:
    resp = requests.get(f"{API_BASE}/scraper/history", timeout=10)
    resp.raise_for_status()
    sessions = resp.json()
    if not sessions:
        console.print("[red]No sessions found.[/red]")
        raise SystemExit(1)
    return sessions[0]["id"]


def _print_status(session_id: int):
    resp = requests.get(f"{API_BASE}/scraper/status", params={"session_id": session_id}, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    status_color = {"running": "green", "paused": "yellow", "completed": "blue", "failed": "red"}
    color = status_color.get(data["status"], "white")
    console.print(f"\n[bold]Session #{session_id}[/bold] — [{color}]{data['status']}[/{color}]")
    console.print(f"  Total items: {data['total_items']}")
    console.print(f"  Errors: {data['errors']}")


def _print_stats(session_id: int):
    resp = requests.get(f"{API_BASE}/scraper/status", params={"session_id": session_id}, timeout=10)
    resp.raise_for_status()
    data = resp.json()

    console.print()
    console.rule(f"[bold]Fitness Data Scraper — Session #{session_id}[/bold]")
    console.print()

    status_color = {"running": "green", "paused": "yellow", "completed": "blue"}
    color = status_color.get(data["status"], "white")
    console.print(f"  Status:  [{color}]{data['status']}[/{color}]")
    console.print(f"  Total:   {data['total_items']:,} items")
    console.print(f"  Errors:  {data['errors']}")
    console.print()

    if data["by_source"]:
        table = Table(title="By Source")
        table.add_column("Source", style="cyan")
        table.add_column("Count", justify="right")
        table.add_column("%", justify="right")
        total = max(data["total_items"], 1)
        for source, count in sorted(data["by_source"].items(), key=lambda x: -x[1]):
            pct = f"{count / total * 100:.1f}%"
            table.add_row(source, str(count), pct)
        console.print(table)

    if data["by_category"]:
        table = Table(title="By Category")
        table.add_column("Category", style="cyan")
        table.add_column("Count", justify="right")
        table.add_column("%", justify="right")
        total = max(data["total_items"], 1)
        for cat, count in sorted(data["by_category"].items(), key=lambda x: -x[1]):
            pct = f"{count / total * 100:.1f}%"
            table.add_row(cat, str(count), pct)
        console.print(table)

    console.rule()


if __name__ == "__main__":
    cli()
