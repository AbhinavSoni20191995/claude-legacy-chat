# Contributing to Claude Legacy Chat

Thanks for your interest in contributing!

## Quick start for contributors

1. Fork this repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/claude-legacy-chat.git`
3. Install dependencies: `npm install`
4. Make your changes
5. Test locally: `node server.js` then open `http://localhost:3000`
6. Push to your fork and open a Pull Request

## What kinds of contributions are welcome

- **Bug fixes** — always welcome
- **UI/UX improvements** — especially for accessibility, mobile polish
- **New features** — open an issue first to discuss
- **Documentation** — typos, clarifications, translations
- **Privacy/security improvements** — high priority

## What contributions are unlikely to be merged

- Adding telemetry, analytics, or any user tracking
- Removing the BYO API key model in favor of a managed-only flow
- Adding paid features to the core repo
- Major rewrites without prior discussion

## Code style

- Match existing style (vanilla JS, no transpiler, no framework)
- Keep dependencies minimal
- Add comments only when behavior isn't obvious from the code
- Preserve the privacy guarantees: server stores nothing, no logging of request bodies

## License of contributions

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

By submitting a pull request, you agree that:

1. Your contribution is your own original work
2. You license your contribution under the AGPL-3.0, the same license as this project
3. You grant the project maintainer (Abhinav Soni) the right to use, modify, and distribute your contribution as part of this project, including the right to offer the combined project under separate commercial terms if the maintainer chooses

The third point means contributions can be incorporated into a future dual-licensed version if needed. This is standard practice for AGPL projects with a single maintainer. If you're not comfortable with this, please open an issue to discuss before contributing.

## Reporting bugs and security issues

- **Regular bugs**: open a GitHub issue
- **Security issues**: email abhinav.soni003@gmail.com directly with subject `SECURITY — Claude Legacy Chat`. Please don't open public issues for security problems.

## Code of conduct

Be kind. Assume good intent. Disagreements about technical choices are fine; personal attacks aren't.

## Questions

Open a discussion or contact abhinav.soni003@gmail.com
