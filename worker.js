const GENERATOR = "https://generator.email";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "Chrome/155.0.0.0 Safari/537.36";

export default {
  async fetch(request) {
    const url = new URL(request.url);

    // ==================================================
    // WEB TEST PAGE
    // ==================================================

    if (url.pathname === "/") {
      return new Response(
        `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Generator.email Test</title>

  <style>
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 20px;
      background: #111;
      color: #eee;
      font-family: Arial, sans-serif;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
    }

    h1 {
      margin-top: 0;
    }

    button {
      border: 0;
      border-radius: 8px;
      padding: 12px 18px;
      background: #4285f4;
      color: white;
      font-weight: bold;
      cursor: pointer;
    }

    button:disabled {
      opacity: .5;
      cursor: not-allowed;
    }

    pre {
      margin-top: 20px;
      padding: 16px;
      border-radius: 10px;
      background: #1c1c1c;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-x: auto;
    }

    .mailbox {
      margin-top: 20px;
      padding: 15px;
      background: #1c1c1c;
      border-radius: 10px;
    }

    .label {
      color: #aaa;
      font-size: 13px;
      margin-bottom: 4px;
    }

    .value {
      margin-bottom: 14px;
      word-break: break-all;
    }
  </style>
</head>

<body>

<div class="container">

  <h1>Generator.email Test</h1>

  <button id="run" onclick="runTest()">
    GENERATE + CHECK INBOX
  </button>

  <div class="mailbox">
    <div class="label">Mailbox</div>
    <div class="value" id="mailbox">-</div>

    <div class="label">Message Count</div>
    <div class="value" id="count">-</div>
  </div>

  <pre id="result">Ready...</pre>

</div>

<script>
async function runTest() {
  const button = document.getElementById("run");
  const result = document.getElementById("result");
  const mailbox = document.getElementById("mailbox");
  const count = document.getElementById("count");

  button.disabled = true;

  result.textContent = "Generating mailbox...";

  mailbox.textContent = "-";
  count.textContent = "-";

  try {
    const response = await fetch("/api/test", {
      method: "GET"
    });

    const data = await response.json();

    if (data.mailbox && data.mailbox.email) {
      mailbox.textContent = data.mailbox.email;
    }

    if (data.inbox) {
      count.textContent = data.inbox.message_count;
    }

    result.textContent = JSON.stringify(data, null, 2);

  } catch (error) {
    result.textContent =
      "ERROR: " + (error?.message || String(error));

  } finally {
    button.disabled = false;
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

    // ==================================================
    // GENERATE + CHECK
    // ==================================================

    if (url.pathname === "/api/test") {
      return await testMailbox();
    }

    // ==================================================
    // CHECK EXISTING MAILBOX
    // ==================================================

    if (url.pathname === "/api/check") {
      if (request.method !== "POST") {
        return Response.json(
          {
            success: false,
            error: "Use POST",
          },
          { status: 405 }
        );
      }

      return await checkExistingMailbox(request);
    }

    // ==================================================
    // NOT FOUND
    // ==================================================

    return Response.json(
      {
        success: false,
        error: "Not found",
      },
      { status: 404 }
    );
  },
};


// ======================================================
// TEST: GENERATE NEW MAILBOX
// ======================================================

async function testMailbox() {
  const started = Date.now();

  try {
    // --------------------------------------------------
    // GET HOMEPAGE
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
          elapsed_ms: Date.now() - started,
        },
        { status: 502 }
      );
    }

    // --------------------------------------------------
    // PARSE MAILBOX
    // --------------------------------------------------

    const mailbox = parseMailbox(homeHtml);

    if (!mailbox.user || !mailbox.domain) {
      return Response.json(
        {
          success: false,
          step: "parse_mailbox",
          error: "Could not find username/domain",
          html_length: homeHtml.length,
          elapsed_ms: Date.now() - started,
        },
        { status: 502 }
      );
    }

    const email =
      `${mailbox.user}@${mailbox.domain}`;

    // --------------------------------------------------
    // CHECK INBOX
    // --------------------------------------------------

    const inbox = await fetchInbox(
      mailbox.user,
      mailbox.domain
    );

    return Response.json({
      success: true,

      mailbox: {
        user: mailbox.user,
        domain: mailbox.domain,
        email,
      },

      inbox: {
        message_count: inbox.message_count,
        message_id: inbox.message_id,
      },

      message: {
        from: inbox.from,
        to: inbox.to,
        subject: inbox.subject,
        body: inbox.body,
        links: inbox.links,
      },

      diagnostics: {
        homepage_status: homeRes.status,
        inbox_status: inbox.status,
        inbox_html_length: inbox.html_length,
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
// CHECK EXISTING MAILBOX
//
// POST /api/check
//
// {
//   "email": "user@domain.com"
// }
// ======================================================

async function checkExistingMailbox(request) {
  const started = Date.now();

  try {
    const contentType =
      request.headers.get("content-type") || "";

    let data;

    if (
      contentType
        .toLowerCase()
        .includes("application/json")
    ) {
      data = await request.json();
    } else {
      const form = await request.formData();

      data = {
        email: form.get("email"),
      };
    }

    const email =
      typeof data?.email === "string"
        ? data.email.trim().toLowerCase()
        : "";

    if (!email || !email.includes("@")) {
      return Response.json(
        {
          success: false,
          error: "Invalid email",
          example: "user@example.com",
        },
        { status: 400 }
      );
    }

    const at = email.lastIndexOf("@");

    const user = email.slice(0, at);
    const domain = email.slice(at + 1);

    if (!user || !domain) {
      return Response.json(
        {
          success: false,
          error: "Invalid mailbox",
        },
        { status: 400 }
      );
    }

    const inbox = await fetchInbox(
      user,
      domain
    );

    return Response.json({
      success: true,

      mailbox: {
        user,
        domain,
        email,
      },

      inbox: {
        message_count: inbox.message_count,
        message_id: inbox.message_id,
      },

      message: {
        from: inbox.from,
        to: inbox.to,
        subject: inbox.subject,
        body: inbox.body,
        links: inbox.links,
      },

      diagnostics: {
        inbox_status: inbox.status,
        inbox_html_length: inbox.html_length,
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
// FETCH INBOX
// ======================================================

async function fetchInbox(user, domain) {
  const inboxUrl =
    `${GENERATOR}/inbox7/`;

  const res = await fetch(inboxUrl, {
    method: "GET",
    redirect: "follow",

    headers: {
      "User-Agent": UA,

      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language":
        "en-US,en;q=0.9",

      "Cookie":
        `inbox_ctx=${domain}/${user}`,
    },
  });

  const html = await res.text();

  if (!res.ok) {
    return {
      status: res.status,
      html_length: html.length,
      message_count: 0,
      message_id: null,
      from: null,
      to: null,
      subject: null,
      body: null,
      links: [],
    };
  }

  const parsed =
    parseMessage(html);

  return {
    status: res.status,
    html_length: html.length,

    message_count:
      parsed.message_count,

    message_id:
      parsed.message_id,

    from:
      parsed.from,

    to:
      parsed.to,

    subject:
      parsed.subject,

    body:
      parsed.body,

    links:
      parsed.links,
  };
}


// ======================================================
// MAILBOX PARSER
// ======================================================

function parseMailbox(html) {
  let user = null;
  let domain = null;

  // --------------------------------------------------
  // SITE_DATA
  // --------------------------------------------------

  const userMatch =
    html.match(
      /cur_user\s*:\s*"([^"]+)"/
    );

  const domainMatch =
    html.match(
      /cur_domain\s*:\s*"([^"]+)"/
    );

  if (userMatch) {
    user =
      decodeHtml(userMatch[1]);
  }

  if (domainMatch) {
    domain =
      decodeHtml(domainMatch[1]);
  }

  // --------------------------------------------------
  // USERNAME INPUT FALLBACK
  // --------------------------------------------------

  if (!user) {
    const input =
      findElementById(
        html,
        "userName"
      );

    if (input) {
      const value =
        getAttribute(
          input,
          "value"
        );

      if (value) {
        user =
          decodeHtml(value);
      }
    }
  }

  // --------------------------------------------------
  // DOMAIN INPUT FALLBACK
  // --------------------------------------------------

  if (!domain) {
    const input =
      findElementById(
        html,
        "domainName2"
      );

    if (input) {
      const value =
        getAttribute(
          input,
          "value"
        );

      if (value) {
        domain =
          decodeHtml(value);
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

  const countMatch =
    html.match(
      /num_mess\s*:\s*(\d+)/
    );

  if (countMatch) {
    result.message_count =
      Number(countMatch[1]);
  }

  // --------------------------------------------------
  // IMPORTANT
  //
  // Kalau inbox kosong, STOP.
  //
  // Jangan pernah memakai seluruh halaman
  // sebagai body email.
  // --------------------------------------------------

  if (result.message_count <= 0) {
    return result;
  }

  // --------------------------------------------------
  // MESSAGE ID
  // --------------------------------------------------

  const msgIdMatch =
    html.match(
      /cur_msg_id\s*:\s*"([^"]+)"/
    );

  if (msgIdMatch) {
    result.message_id =
      msgIdMatch[1];
  }

  if (!result.message_id) {
    const dataMid =
      html.match(
        /data-mid\s*=\s*"([^"]+)"/i
      );

    if (dataMid) {
      result.message_id =
        dataMid[1];
    }
  }

  // --------------------------------------------------
  // FIND MESSAGE HTML
  // --------------------------------------------------

  let messageHtml = html;

  if (result.message_id) {
    const escapedId =
      escapeRegex(
        result.message_id
      );

    const markerRegex =
      new RegExp(
        `<[^>]+data-mid\\s*=\\s*["']${escapedId}["'][^>]*>[\\s\\S]*`,
        "i"
      );

    const found =
      html.match(markerRegex);

    if (found) {
      messageHtml =
        found[0];
    }
  }

  // --------------------------------------------------
  // FROM
  // --------------------------------------------------

  result.from =
    extractHeader(
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

  result.to =
    extractHeader(
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

  result.subject =
    extractHeader(
      messageHtml,
      [
        "Subject",
        "subject",
      ]
    );

  // --------------------------------------------------
  // BODY
  // --------------------------------------------------

  result.body =
    extractBody(
      messageHtml
    );

  // --------------------------------------------------
  // LINKS
  // --------------------------------------------------

  const linkRegex =
    /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

  const seen =
    new Set();

  let match;

  while (
    (match =
      linkRegex.exec(messageHtml))
  ) {
    let link =
      decodeHtml(
        match[1]
      ).trim();

    if (!link) {
      continue;
    }

    if (
      link.startsWith(
        "javascript:"
      ) ||
      link.startsWith("#") ||
      link.startsWith("mailto:")
    ) {
      continue;
    }

    if (
      !/^https?:\/\//i.test(
        link
      )
    ) {
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

function extractHeader(
  html,
  names
) {
  for (
    const name of names
  ) {
    const patterns = [

      // Table/div layout
      new RegExp(
        `<[^>]*>\\s*${escapeRegex(name)}\\s*:?\\s*</[^>]+>\\s*<[^>]*>([\\s\\S]*?)</[^>]+>`,
        "i"
      ),

      // Plain text
      new RegExp(
        `${escapeRegex(name)}\\s*:\\s*([^<\\r\\n]+)`,
        "i"
      ),

      // data-* attribute
      new RegExp(
        `data-${escapeRegex(name.toLowerCase())}\\s*=\\s*["']([^"']+)["']`,
        "i"
      ),
    ];

    for (
      const regex of patterns
    ) {
      const match =
        html.match(regex);

      if (
        match &&
        match[1]
      ) {
        const value =
          cleanText(
            match[1]
          );

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
  const candidates = [

    /class\s*=\s*["'][^"']*mailbody[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,

    /class\s*=\s*["'][^"']*mail-body[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,

    /class\s*=\s*["'][^"']*message-body[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,

    /class\s*=\s*["'][^"']*mailtext[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
  ];

  for (
    const regex of candidates
  ) {
    const match =
      html.match(regex);

    if (
      match &&
      match[1]
    ) {
      const text =
        htmlToText(
          match[1]
        );

      if (
        text.length > 0
      ) {
        return text;
      }
    }
  }

  // Jangan fallback ke seluruh HTML.
  return null;
}


// ======================================================
// FIND HTML ELEMENT BY ID
// ======================================================

function findElementById(
  html,
  id
) {
  const regex =
    new RegExp(
      `<([a-zA-Z0-9]+)\\b[^>]*\\bid\\s*=\\s*["']${escapeRegex(id)}["'][^>]*>`,
      "i"
    );

  const match =
    html.match(regex);

  if (!match) {
    return null;
  }

  return match[0];
}


// ======================================================
// GET HTML ATTRIBUTE
// ======================================================

function getAttribute(
  tag,
  name
) {
  const regex =
    new RegExp(
      `\\b${escapeRegex(name)}\\s*=\\s*["']([^"']*)["']`,
      "i"
    );

  const match =
    tag.match(regex);

  return match
    ? match[1]
    : null;
}


// ======================================================
// HTML -> TEXT
// ======================================================

function htmlToText(
  html
) {
  return decodeHtml(
    html
      .replace(
        /<script\b[^>]*>[\s\S]*?<\/script>/gi,
        " "
      )

      .replace(
        /<style\b[^>]*>[\s\S]*?<\/style>/gi,
        " "
      )

      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )

      .replace(
        /<\/p>/gi,
        "\n"
      )

      .replace(
        /<\/div>/gi,
        "\n"
      )

      .replace(
        /<\/tr>/gi,
        "\n"
      )

      .replace(
        /<[^>]+>/g,
        " "
      )

      .replace(
        /\r/g,
        ""
      )

      .replace(
        /[ \t]+/g,
        " "
      )

      .replace(
        /\n\s+/g,
        "\n"
      )

      .replace(
        /\n{3,}/g,
        "\n\n"
      )

      .trim()
  );
}


// ======================================================
// CLEAN TEXT
// ======================================================

function cleanText(
  value
) {
  return decodeHtml(
    value
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim()
  );
}


// ======================================================
// HTML ENTITY DECODE
// ======================================================

function decodeHtml(
  value
) {
  return String(value)
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&#(\d+);/g,
      (_, n) =>
        String.fromCharCode(
          Number(n)
        )
    )
    .replace(
      /&#x([0-9a-f]+);/gi,
      (_, n) =>
        String.fromCharCode(
          parseInt(n, 16)
        )
    );
}


// ======================================================
// REGEX ESCAPE
// ======================================================

function escapeRegex(
  value
) {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );
}
