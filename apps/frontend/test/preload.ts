// Date tests assume the app's display time zone. Pin it so results don't
// depend on the machine or runner: `bun test` defaults to UTC, but a `TZ`
// inherited from the shell (e.g. UTC+7) shifts local-time dates across days.
process.env.TZ = 'Europe/Berlin';
