const GENERATOR = "https://generator.email";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "Chrome/155.0.0.0 Safari/537.36";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/") {
      return new Response(
        `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Generator Email Test</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      max-width: 900px;
      margin: 30px auto;
      padding: 20px;
      background: #111;
      color: #eee;
    }
    button {
      padding: 10px 16px;
      cursor: pointer;
      margin-bottom: 15px;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #1d1d1d;
      padding: 15px;
      border-radius: 8px;
    }
  </style>
</head>
<body>
  <h2>Generator.email Test</h2>

  <button onclick="runTest()">GENERATE + CHECK INBOX</button>

  <pre id="result">Ready...</pre>

  <script>
    async function runTest() {
      const el = document.getElementById("result");
      el.textContent = "Processing...";

      try {
        const res = await fetch("/api/test");
        const data = await res.json();

        el.textContent = JSON.stringify(data, null, 2);
      } catch (e) {
        el.textContent = "ERROR: " + e.message;
      }
    }
  </script>
</body>
</html>`,
        {
          headers: {
            "content-type": "text/html; charset=UTF-8",
          },
        }
      );
    }

    if (url.pathname === "/api/test") {
      return await testMailbox();
    }

    return Response.json(
      {
        success: false,
        error: "Not found",
      },
      { status: 404 }
    );
  },
};

async function testMailbox() {
  const started = Date.now();

  try {
    // --------------------------------------------------
    // 1. GET HOMEPAGE
    // --------------------------------------------------

    const homeRes = await fetch(`${GENERATOR}/`, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    const homeHtml = await homeRes.text();

    if (!homeRes.ok) {
      return Response.json(
        {
          success: false,
          step: "homepage",
          status: homeRes.status,
          body_preview: homeHtml.slice(0, 1000),
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 2. FIND GENERATED USERNAME + DOMAIN
    // --------------------------------------------------

    const mailbox = parseMailbox(homeHtml);

    if (!mailbox.user || !mailbox.domain) {
      return Response.json(
        {
          success: false,
          step: "parse_mailbox",
          error: "Could not find username/domain",
          html_length: homeHtml.length,
        },
        { status: 502 }
      );
    }

    const email = `${mailbox.user}@${mailbox.domain}`;

    // --------------------------------------------------
    // 3. READ INBOX
    // --------------------------------------------------

    const inboxUrl = `${GENERATOR}/inbox7/`;

    const inboxRes = await fetch(inboxUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": `inbox_ctx=${mailbox.domain}/${mailbox.user}`,
      },
    });

    const inboxHtml = await inboxRes.text();

    if (!inboxRes.ok) {
      return Response.json(
        {
          success: false,
          step: "inbox",
          status: inboxRes.status,
          mailbox: {
            user: mailbox.user,
            domain: mailbox.domain,
            email,
          },
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // 4. PARSE MESSAGE
    // --------------------------------------------------

    const message = parseMessage(inboxHtml);

    return Response.json({
      success: true,

      mailbox: {
        user: mailbox.user,
        domain: mailbox.domain,
        email,
      },

      inbox: {
        message_count: message.message_count,
        message_id: message.message_id,
      },

      message: {
        from: message.from,
        to: message.to,
        subject: message.subject,
        body: message.body,
        links: message.links,
      },

      diagnostics: {
        homepage_status: homeRes.status,
        inbox_status: inboxRes.status,
        inbox_html_length: inboxHtml.length,
        elapsed_ms: Date.now() - started,
      },
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error?.message || String(error),
        error_name: error?.name || null,
        elapsed_ms: Date.now() - started,
      },
      { status: 500 }
    );
  }
}


// ======================================================
// MAILBOX PARSER
// ======================================================

function parseMailbox(html) {
  let user = null;
  let domain = null;

  // SITE_DATA fallback
  const userMatch = html.match(/cur_user\s*:\s*"([^"]+)"/);
  const domainMatch = html.match(/cur_domain\s*:\s*"([^"]+)"/);

  if (userMatch) {
    user = decodeHtml(userMatch[1]);
  }

  if (domainMatch) {
    domain = decodeHtml(domainMatch[1]);
  }

  // input#userName fallback
  if (!user) {
    const input = findElementById(html, "userName");

    if (input) {
      const value = getAttribute(input, "value");

      if (value) {
        user = decodeHtml(value);
      }
    }
  }

  // input#domainName2 fallback
  if (!domain) {
    const input = findElementById(html, "domainName2");

    if (input) {
      const value = getAttribute(input, "value");

      if (value) {
        domain = decodeHtml(value);
      }
    }
  }

  return {
    user,
    domain,
  };
}


// ======================================================
// MESSAGE PARSER
// ======================================================

function parseMessage(html) {
  const result = {
    message_count: 0,
    message_id: null,
    from: null,
    to: null,
    subject: null,
    body: null,
    links: [],
  };

  // --------------------------------------------------
  // MESSAGE COUNT
  // --------------------------------------------------

  const countMatch = html.match(/num_mess\s*:\s*(\d+)/);

  if (countMatch) {
    result.message_count = Number(countMatch[1]);
  }

  // --------------------------------------------------
  // MESSAGE ID
  // --------------------------------------------------

  const msgIdMatch = html.match(
    /cur_msg_id\s*:\s*"([^"]+)"/
  );

  if (msgIdMatch) {
    result.message_id = msgIdMatch[1];
  }

  if (!result.message_id) {
    const dataMid = html.match(
      /data-mid\s*=\s*"([^"]+)"/i
    );

    if (dataMid) {
      result.message_id = dataMid[1];
    }
  }

  // --------------------------------------------------
  // LOCATE MAIL CONTAINER
  // --------------------------------------------------

  let messageHtml = html;

  if (result.message_id) {
    const marker =
      `data-mid="${escapeRegex(result.message_id)}"`;

    const markerRegex = new RegExp(
      `<[^>]+${marker}[^>]*>[\\s\\S]*?</[^>]+>`,
      "i"
    );

    const found = html.match(markerRegex);

    if (found) {
      messageHtml = found[0];
    }
  }

  // --------------------------------------------------
  // FROM
  // --------------------------------------------------

  result.from = extractHeader(
    messageHtml,
    [
      "From",
      "from",
      "Sender",
    ]
  );

  // --------------------------------------------------
  // TO
  // --------------------------------------------------

  result.to = extractHeader(
    messageHtml,
    [
      "To",
      "to",
      "Recipient",
    ]
  );

  // --------------------------------------------------
  // SUBJECT
  // --------------------------------------------------

  result.subject = extractHeader(
    messageHtml,
    [
      "Subject",
      "subject",
    ]
  );

  // --------------------------------------------------
  // BODY
  // --------------------------------------------------

  result.body = extractBody(messageHtml);

  // --------------------------------------------------
  // LINKS
  // --------------------------------------------------

  const linkRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

  const seen = new Set();

  let match;

  while ((match = linkRegex.exec(messageHtml))) {
    let link = decodeHtml(match[1]).trim();

    if (!link) continue;

    if (
      link.startsWith("javascript:") ||
      link.startsWith("#") ||
      link.startsWith("mailto:")
    ) {
      continue;
    }

    if (!/^https?:\/\//i.test(link)) {
      continue;
    }

    if (!seen.has(link)) {
      seen.add(link);
      result.links.push(link);
    }
  }

  return result;
}


// ======================================================
// HEADER EXTRACTION
// ======================================================

function extractHeader(html, names) {
  for (const name of names) {
    const patterns = [
      new RegExp(
        `<[^>]*>\\s*${escapeRegex(name)}\\s*:?\\s*</[^>]+>\\s*<[^>]*>([\\s\\S]*?)</[^>]+>`,
        "i"
      ),

      new RegExp(
        `${escapeRegex(name)}\\s*:\\s*([^<\\r\\n]+)`,
        "i"
      ),

      new RegExp(
        `data-${escapeRegex(name.toLowerCase())}\\s*=\\s*["']([^"']+)["']`,
        "i"
      ),
    ];

    for (const regex of patterns) {
      const match = html.match(regex);

      if (match && match[1]) {
        const value = cleanText(match[1]);

        if (value) {
          return value;
        }
      }
    }
  }

  return null;
}


// ======================================================
// BODY EXTRACTION
// ======================================================

function extractBody(html) {
  // Cari bagian yang biasanya menjadi isi email.
  const candidates = [
    /class\s*=\s*["'][^"']*mailbody[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,

    /class\s*=\s*["'][^"']*mail-body[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,

    /class\s*=\s*["'][^"']*message-body[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,

    /class\s*=\s*["'][^"']*mailtext[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  ];

  for (const regex of candidates) {
    const match = html.match(regex);

    if (match && match[1]) {
      const text = htmlToText(match[1]);

      if (text.length > 0) {
        return text;
      }
    }
  }

  // Fallback: ambil teks dari container.
  const text = htmlToText(html);

  return text || null;
}


// ======================================================
// HELPERS
// ======================================================

function findElementById(html, id) {
  const regex = new RegExp(
    `<([a-zA-Z0-9]+)\\b[^>]*\\bid\\s*=\\s*["']${escapeRegex(id)}["'][^>]*>`,
    "i"
  );

  const match = html.match(regex);

  if (!match) {
    return null;
  }

  return match[0];
}


function getAttribute(tag, name) {
  const regex = new RegExp(
    `\\b${escapeRegex(name)}\\s*=\\s*["']([^"']*)["']`,
    "i"
  );

  const match = tag.match(regex);

  return match ? match[1] : null;
}


function htmlToText(html) {
  return decodeHtml(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/\r/g, "")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}


function cleanText(value) {
  return decodeHtml(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}


function decodeHtml(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, n) =>
      String.fromCharCode(Number(n))
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, n) =>
      String.fromCharCode(parseInt(n, 16))
    );
}


function escapeRegex(value) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}
