#!/usr/bin/env python3

import argparse
import json
import sqlite3
import tempfile
import zipfile
from pathlib import Path


DECK_ID = 1_700_000_000_000
BASIC_NOTE_TYPE_ID = 1001
CLOZE_NOTE_TYPE_ID = 1002


def create_collection(path: Path) -> None:
    connection = sqlite3.connect(path)
    try:
        connection.executescript(
            """
            CREATE TABLE col (
                id integer primary key,
                models text not null,
                decks text not null
            );
            CREATE TABLE notes (
                id integer primary key,
                guid text not null,
                mid integer not null,
                flds text not null
            );
            CREATE TABLE cards (
                id integer primary key,
                nid integer not null,
                did integer not null,
                ord integer not null
            );
            CREATE TABLE revlog (
                id integer primary key,
                cid integer not null,
                ease integer not null,
                ivl integer not null,
                lastIvl integer not null,
                factor integer not null,
                time integer not null,
                type integer not null
            );
            """
        )

        models = {
            str(BASIC_NOTE_TYPE_ID): {
                "id": BASIC_NOTE_TYPE_ID,
                "name": "Basic",
                "flds": [{"name": "Front"}, {"name": "Back"}],
                "tmpls": [
                    {
                        "name": "Card 1",
                        "ord": 0,
                        "qfmt": "{{Front}}",
                        "afmt": '{{FrontSide}}<hr id="answer">{{Back}}',
                    },
                    {
                        "name": "Card 2",
                        "ord": 1,
                        "qfmt": "{{Back}}",
                        "afmt": '{{FrontSide}}<hr id="answer">{{Front}}',
                    },
                ],
            },
            str(CLOZE_NOTE_TYPE_ID): {
                "id": CLOZE_NOTE_TYPE_ID,
                "name": "Cloze",
                "flds": [{"name": "Text"}],
                "tmpls": [
                    {
                        "name": "Cloze",
                        "ord": 0,
                        "qfmt": "{{cloze:Text}}",
                        "afmt": "{{cloze:Text}}",
                    }
                ],
            },
        }
        decks = {str(DECK_ID): {"id": DECK_ID, "name": "Deployment import smoke"}}
        connection.execute(
            "INSERT INTO col (id, models, decks) VALUES (1, ?, ?)",
            (json.dumps(models), json.dumps(decks)),
        )

        field_separator = "\x1f"
        connection.executemany(
            "INSERT INTO notes (id, guid, mid, flds) VALUES (?, ?, ?, ?)",
            [
                (
                    501,
                    "deployment-import-smoke-basic",
                    BASIC_NOTE_TYPE_ID,
                    "Learning OS import smoke [sound:word.mp3]"
                    + field_separator
                    + '<img src="pixel.png"> disposable fixture',
                ),
                (
                    502,
                    "deployment-import-smoke-cloze",
                    CLOZE_NOTE_TYPE_ID,
                    "{{c1::Deployment import smoke}}",
                ),
            ],
        )
        connection.executemany(
            "INSERT INTO cards (id, nid, did, ord) VALUES (?, ?, ?, ?)",
            [
                (701, 501, DECK_ID, 0),
                (702, 501, DECK_ID, 1),
                (703, 502, DECK_ID, 0),
            ],
        )
        connection.executemany(
            """
            INSERT INTO revlog (id, cid, ease, ivl, lastIvl, factor, time, type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (1_700_000_000_123, 701, 3, 12, 6, 2500, 980, 1),
                (1_700_000_000_456, 703, 4, 21, 12, 2600, 760, 1),
            ],
        )
        connection.commit()
    finally:
        connection.close()


def verify_archive(path: Path, expected_media_bytes: int) -> None:
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        if names != {"collection.anki21", "media", "0", "1"}:
            raise RuntimeError(f"Unexpected archive entries: {sorted(names)}")
        if archive.getinfo("0").file_size != expected_media_bytes:
            raise RuntimeError("The generated streaming payload has the wrong size.")
        if json.loads(archive.read("media")) != {"0": "word.mp3", "1": "pixel.png"}:
            raise RuntimeError("The generated media map is invalid.")

        with tempfile.NamedTemporaryFile() as collection:
            collection.write(archive.read("collection.anki21"))
            collection.flush()
            connection = sqlite3.connect(collection.name)
            try:
                counts = tuple(
                    connection.execute(f"SELECT count(*) FROM {table}").fetchone()[0]
                    for table in ("notes", "cards", "revlog")
                )
            finally:
                connection.close()

    if counts != (2, 3, 2):
        raise RuntimeError(f"Unexpected collection counts: {counts}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Create a disposable .colpkg for the production import lifecycle smoke."
    )
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--media-bytes",
        type=int,
        default=32 * 1024 * 1024,
        help="Stored media payload size used to exercise streaming uploads.",
    )
    args = parser.parse_args()

    if args.media_bytes < 1:
        parser.error("--media-bytes must be positive")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as temporary_directory:
        collection_path = Path(temporary_directory) / "collection.anki21"
        create_collection(collection_path)
        with zipfile.ZipFile(args.output, "w", compression=zipfile.ZIP_STORED) as archive:
            archive.write(collection_path, "collection.anki21")
            archive.writestr("media", json.dumps({"0": "word.mp3", "1": "pixel.png"}))
            archive.writestr("0", b"\0" * args.media_bytes)
            archive.writestr(
                "1",
                bytes.fromhex(
                    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489"
                    "0000000d4944415408d763f8cfc0f01f00050001ff89993d1d0000000049454e44"
                    "ae426082"
                ),
            )

    verify_archive(args.output, args.media_bytes)
    print(args.output)


if __name__ == "__main__":
    main()
