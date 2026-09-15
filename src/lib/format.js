export const fecha = (d) => (d ? new Date(d).toLocaleString("es-CL", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");

export const initials = (s) => (s || "?").split(/\s+/).slice(0, 2).map((w) => w[0] || "").join("").toUpperCase();