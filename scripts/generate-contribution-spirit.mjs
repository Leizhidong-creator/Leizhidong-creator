import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(projectRoot, "assets/contribution-spirit.svg");
const isDemo = process.argv.includes("--demo");
const username = process.env.GITHUB_USER || process.env.GITHUB_REPOSITORY_OWNER || "Leizhidong-creator";

function demoWeeks() {
  return Array.from({ length: 53 }, (_, week) => ({
    contributionDays: Array.from({ length: 7 }, (_, day) => ({
      date: `demo-${week}-${day}`,
      contributionCount: [9, 19, 31, 38, 44, 49, 51].includes(week) && day === (week % 7) ? (week % 4) + 1 : 0,
    })),
  }));
}

async function fetchWeeks() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required unless --demo is used.");

  const query = `
    query($login: String!) {
      user(login: $login) {
        contributionsCollection {
          contributionCalendar {
            weeks {
              contributionDays { date contributionCount }
            }
          }
        }
      }
    }
  `;

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "contribution-spirit-action",
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });

  if (!response.ok) throw new Error(`GitHub GraphQL request failed: ${response.status}`);
  const payload = await response.json();
  if (payload.errors?.length) throw new Error(payload.errors.map((error) => error.message).join("; "));

  const weeks = payload.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks?.length) throw new Error(`No contribution data returned for ${username}.`);
  return weeks;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]);
}

function render(weeks) {
  const cell = 14;
  const gap = 5;
  const originX = 74;
  const originY = 92;
  const maxCount = Math.max(1, ...weeks.flatMap((week) => week.contributionDays.map((day) => day.contributionCount)));
  const colors = ["#E6E0D4", "#BCEAF0", "#55C5D8", "#FFD84D", "#FF6B57"];
  const cells = [];
  let total = 0;

  weeks.slice(-53).forEach((week, weekIndex) => {
    week.contributionDays.forEach((day, dayIndex) => {
      total += day.contributionCount;
      const level = day.contributionCount === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((day.contributionCount / maxCount) * 4)));
      const x = originX + weekIndex * (cell + gap);
      const y = originY + dayIndex * (cell + gap);
      cells.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="4" fill="${colors[level]}"><title>${escapeXml(day.date)}: ${day.contributionCount} contribution${day.contributionCount === 1 ? "" : "s"}</title></rect>`);
    });
  });

  const pathStartX = originX + 4;
  const pathEndX = originX + 52 * (cell + gap) + 10;
  const travelY = originY + 3 * (cell + gap) + 7;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="290" viewBox="0 0 1200 290" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(username)} contribution spirit</title>
  <desc id="desc">A playful data spirit travels across a calendar showing ${total} GitHub contributions in the displayed period.</desc>
  <rect x="8" y="8" width="1184" height="274" rx="24" fill="#FFF8EA" stroke="#17212B" stroke-width="4"/>
  <g font-family="'Bricolage Grotesque','Trebuchet MS','Microsoft YaHei',sans-serif" fill="#17212B">
    <text x="48" y="54" font-size="24" font-weight="900">CONTRIBUTION SPIRIT</text>
    <text x="382" y="53" font-size="14" font-weight="700" fill="#59636E">COLLECTING SMALL STEPS · CREATING MEANINGFUL THINGS</text>
  </g>
  <g>${cells.join("")}</g>
  <path id="spirit-path" d="M${pathStartX} ${travelY} H${pathEndX}" fill="none"/>
  <g>
    <animateMotion dur="11s" repeatCount="indefinite" rotate="auto"><mpath href="#spirit-path"/></animateMotion>
    <path d="M-17-14c0-10 8-17 18-17h16c11 0 19 7 19 17V3c0 10-8 17-19 17H8L-5 31l2-12c-8-2-14-8-14-16z" fill="#FFFFFF" stroke="#17212B" stroke-width="4"/>
    <circle cx="-3" cy="-3" r="4" fill="#17212B"/><circle cx="16" cy="-3" r="4" fill="#17212B"/>
    <path d="M-1 8c6 5 12 5 18 0" fill="none" stroke="#FF6B57" stroke-width="3" stroke-linecap="round"/>
    <circle cx="29" cy="-22" r="6" fill="#FFD84D"><animate attributeName="r" values="5;8;5" dur="1.4s" repeatCount="indefinite"/></circle>
  </g>
  <g font-family="'IBM Plex Mono','Consolas',monospace" font-size="13" font-weight="700" fill="#59636E">
    <text x="74" y="254">${isDemo ? "PREVIEW DATA · REFRESHES AFTER THE FIRST WORKFLOW RUN" : `${total} CONTRIBUTIONS · UPDATED BY GITHUB ACTIONS`}</text>
  </g>
</svg>`;
}

const weeks = isDemo ? demoWeeks() : await fetchWeeks();
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, render(weeks), "utf8");
console.log(`Wrote ${outputPath}`);
