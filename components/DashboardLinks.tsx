import Link from "next/link";
import "@/components/fh.css";

// Quick links shown on the admin and organizer dashboards.
const LINKS = {
    ADMIN: [
        { href: "/events", label: "Browse events" },
        { href: "/admin/events", label: "Manage events" },
        { href: "/admin/venues", label: "Venues" },
        { href: "/admin/assign", label: "Organizers and judges" },
    ],
    ORGANIZER: [
        { href: "/events", label: "Browse events" },
        { href: "/organizer/events", label: "My events" },
    ],
};

export default function DashboardLinks({ role }: { role: "ADMIN" | "ORGANIZER" }) {
    return (
        <nav className="fh-links">
            {LINKS[role].map((l) => (
                <Link key={l.href} href={l.href}>{l.label}</Link>
            ))}
        </nav>
    );
}
