from __future__ import annotations

import argparse
import os
import smtplib
import ssl
from email.message import EmailMessage


def env(name: str, required: bool = True) -> str | None:
    value = os.environ.get(name)
    if required and not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def main() -> int:
    parser = argparse.ArgumentParser(description="Send UK inflation tool notification email.")
    parser.add_argument("--subject", required=True)
    parser.add_argument("--body", required=True)
    args = parser.parse_args()

    required_names = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "NOTIFY_EMAIL_TO"]
    missing = [name for name in required_names if not os.environ.get(name)]
    if missing:
        print(f"Skipping notification email; missing secrets: {', '.join(missing)}")
        return 0

    host = env("SMTP_HOST")
    port = int(env("SMTP_PORT", required=False) or "587")
    username = env("SMTP_USER")
    password = env("SMTP_PASS")
    from_address = env("NOTIFY_EMAIL_FROM", required=False) or username
    to_address = env("NOTIFY_EMAIL_TO")

    message = EmailMessage()
    message["Subject"] = args.subject
    message["From"] = from_address
    message["To"] = to_address
    message.set_content(args.body)

    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, context=context) as server:
            server.login(username, password)
            server.send_message(message)
    else:
        with smtplib.SMTP(host, port) as server:
            server.starttls(context=context)
            server.login(username, password)
            server.send_message(message)

    print(f"Notification email sent to {to_address}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
