
export const MAX_TEAM_SIZE = 5; // Maximum number of members allowed in a team
export const SESSION_COOKIE = 'festhub_session'; // Name of the cookie used to store session information
export const SESSION_HOURS = 8; // Duration (in hours) for which a session is valid
export const MAX_INTERESTS = 20; // Maximum number of interests a participant can have
export const ROLES = ['STUDENT', 'ORGANIZER', 'ADMIN'] as const; // Different roles available in the system
export type Role = (typeof ROLES)[number]; // Type definition for Role based on the ROLES array
