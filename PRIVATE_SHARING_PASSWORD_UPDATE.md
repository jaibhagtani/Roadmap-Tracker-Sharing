# Private sharing password protection

- Private roadmap share links are password-protected.
- Passwords are generated server-side, stored only as scrypt hashes, and delivered to the intended recipient in the database notification created by the share request flow.
- `/api/shared/[slug]` rejects private roadmap access until unlocked.
- `/api/shared/[slug]/unlock` verifies the password and returns the roadmap.
- Public and Friends/Link sharing behavior is unchanged.
- Clone remains available only for Public and Friends/Link.
- Private sharing remains separate from collaboration permissions and does not expose the owner's roadmap through the public endpoint.

- The notification center preserves the password/link formatting with `whitespace-pre-wrap`, so recipients can read and copy the credentials reliably.
- Private mode is labeled “Private · Password protected” in the roadmap editor.
