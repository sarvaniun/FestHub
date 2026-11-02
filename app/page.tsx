
import Link from "next/link";

export default function Home() {
    return (
        <main>
            <section className="hero">
                <h1>
                    Discover. Participate. Experience.
                </h1>

                <p>
                    Welcome to FestHub, your one-stop platform to
                    discover campus events, register for competitions,
                    and connect with your college community.
                </p>

                <div className="hero-actions">
                    <Link href="/signup" className="hero-button">
                        Get Started
                    </Link>

                    <Link
                        href="/login"
                        className="hero-button secondary"
                    >
                        Login
                    </Link>
                </div>
            </section>

            <section className="page-container">
                <h2 style={{ textAlign: "center", marginBottom: 15 }}>
                    Everything Campus Events, In One Place
                </h2>

                <p style={{
                    textAlign: "center",
                    color: "var(--muted)",
                    lineHeight: 1.7
                }}>
                    Explore upcoming events, register individually or
                    with your team, and stay updated on your participation.
                </p>
            </section>
        </main>
    );
}
