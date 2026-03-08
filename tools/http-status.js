// tools/http-status.js — HTTP Status Code Reference

import { copyText } from './utils.js';

const httpSearch  = document.getElementById('httpSearch');
const httpCount   = document.getElementById('httpCount');
const httpList    = document.getElementById('httpList');

// ── Status code data (IANA registry) ──────────────────────────────────────────

const CODES = [
  // 1xx Informational
  { code: 100, phrase: 'Continue',                        desc: 'Server has received the request headers; client should proceed to send the body.' },
  { code: 101, phrase: 'Switching Protocols',             desc: 'Server is switching protocols as requested by the client via Upgrade header.' },
  { code: 102, phrase: 'Processing',                      desc: 'Server has received and is processing the request, but no response is available yet.' },
  { code: 103, phrase: 'Early Hints',                     desc: 'Used to return response headers before final response; allows preloading of resources.' },

  // 2xx Success
  { code: 200, phrase: 'OK',                              desc: 'Request succeeded. The response body contains the requested data.' },
  { code: 201, phrase: 'Created',                         desc: 'Request succeeded and a new resource was created. Location header points to the new resource.' },
  { code: 202, phrase: 'Accepted',                        desc: 'Request accepted for processing, but processing is not complete or may not occur.' },
  { code: 203, phrase: 'Non-Authoritative Information',   desc: 'Response is from a transforming proxy that modified the origin server\'s 200 response.' },
  { code: 204, phrase: 'No Content',                      desc: 'Request succeeded but there is no content to return. Common after DELETE requests.' },
  { code: 205, phrase: 'Reset Content',                   desc: 'Request succeeded; client should reset the document view (e.g., clear a form).' },
  { code: 206, phrase: 'Partial Content',                 desc: 'Server is delivering only a portion of the resource due to a Range header in the request.' },
  { code: 207, phrase: 'Multi-Status',                    desc: 'Response body contains multiple status codes for multiple independent operations (WebDAV).' },
  { code: 208, phrase: 'Already Reported',                desc: 'Members of a DAV binding have already been enumerated and not included again (WebDAV).' },
  { code: 226, phrase: 'IM Used',                         desc: 'Server fulfilled a GET request using instance manipulations (delta encoding).' },

  // 3xx Redirection
  { code: 300, phrase: 'Multiple Choices',                desc: 'Multiple possible responses exist; the client should choose one. Rarely used in practice.' },
  { code: 301, phrase: 'Moved Permanently',               desc: 'Resource has been permanently moved to the URL in the Location header. Clients should update bookmarks.' },
  { code: 302, phrase: 'Found',                           desc: 'Resource temporarily resides at a different URI. Clients should continue using the original URL.' },
  { code: 303, phrase: 'See Other',                       desc: 'Redirect to another URI after a POST/PUT/DELETE using GET. Prevents duplicate form submissions.' },
  { code: 304, phrase: 'Not Modified',                    desc: 'Resource has not changed since the version specified by request headers. Use the cached version.' },
  { code: 307, phrase: 'Temporary Redirect',              desc: 'Resource temporarily at a different URI. Method and body must not change on redirect.' },
  { code: 308, phrase: 'Permanent Redirect',              desc: 'Resource permanently moved. Method and body must not change on redirect (unlike 301).' },

  // 4xx Client Errors
  { code: 400, phrase: 'Bad Request',                     desc: 'Server cannot process the request due to malformed syntax or invalid request message framing.' },
  { code: 401, phrase: 'Unauthorized',                    desc: 'Authentication is required. The client must provide credentials via the Authorization header.' },
  { code: 402, phrase: 'Payment Required',                desc: 'Reserved for future use. Some services use it to indicate a payment wall.' },
  { code: 403, phrase: 'Forbidden',                       desc: 'Server understands the request but refuses to authorize it. Credentials won\'t help.' },
  { code: 404, phrase: 'Not Found',                       desc: 'Resource could not be found at the given URI. May be temporary or permanent.' },
  { code: 405, phrase: 'Method Not Allowed',              desc: 'HTTP method used is not supported for this resource. Allow header lists supported methods.' },
  { code: 406, phrase: 'Not Acceptable',                  desc: 'Server cannot produce a response matching the Accept headers sent by the client.' },
  { code: 407, phrase: 'Proxy Authentication Required',   desc: 'Authentication with a proxy is required before this request can be served.' },
  { code: 408, phrase: 'Request Timeout',                 desc: 'Server timed out waiting for the request. Client may resubmit the request.' },
  { code: 409, phrase: 'Conflict',                        desc: 'Request conflicts with the current state of the server (e.g., version conflict on update).' },
  { code: 410, phrase: 'Gone',                            desc: 'Resource has been permanently deleted and no forwarding address is known. Unlike 404, this is permanent.' },
  { code: 411, phrase: 'Length Required',                 desc: 'Server requires the Content-Length header, which the client did not send.' },
  { code: 412, phrase: 'Precondition Failed',             desc: 'Conditional request precondition (If-Match, If-Unmodified-Since) evaluated to false.' },
  { code: 413, phrase: 'Content Too Large',               desc: 'Request body exceeds the server\'s configured limit. Formerly "Payload Too Large".' },
  { code: 414, phrase: 'URI Too Long',                    desc: 'Request URI is longer than the server is willing to interpret.' },
  { code: 415, phrase: 'Unsupported Media Type',          desc: 'Server refuses the request because the content format is not supported.' },
  { code: 416, phrase: 'Range Not Satisfiable',           desc: 'Range header in request cannot be fulfilled (range out of bounds for the resource).' },
  { code: 417, phrase: 'Expectation Failed',              desc: 'Server cannot meet the requirements of the Expect request header.' },
  { code: 418, phrase: 'I\'m a Teapot',                  desc: 'Server refuses to brew coffee because it is, permanently, a teapot. (RFC 2324, April Fools.)' },
  { code: 421, phrase: 'Misdirected Request',             desc: 'Request was directed at a server that cannot produce a response for the target URI.' },
  { code: 422, phrase: 'Unprocessable Content',           desc: 'Request is well-formed but contains semantic errors. Common in REST validation failures.' },
  { code: 423, phrase: 'Locked',                          desc: 'Resource being accessed is locked (WebDAV).' },
  { code: 424, phrase: 'Failed Dependency',               desc: 'Request failed because it depended on another request that also failed (WebDAV).' },
  { code: 425, phrase: 'Too Early',                       desc: 'Server is unwilling to risk processing a request that might be replayed (TLS early data).' },
  { code: 426, phrase: 'Upgrade Required',                desc: 'Client must switch to a different protocol as specified in the Upgrade response header.' },
  { code: 428, phrase: 'Precondition Required',           desc: 'Server requires the request to be conditional to prevent lost-update problems.' },
  { code: 429, phrase: 'Too Many Requests',               desc: 'Client has sent too many requests in a given time window (rate limiting). Retry-After may be present.' },
  { code: 431, phrase: 'Request Header Fields Too Large', desc: 'Individual header field or all header fields collectively are too large to process.' },
  { code: 451, phrase: 'Unavailable For Legal Reasons',   desc: 'Resource cannot be provided due to a legal demand (court order, government censorship, DMCA).' },

  // 5xx Server Errors
  { code: 500, phrase: 'Internal Server Error',           desc: 'Server encountered an unexpected condition that prevented it from fulfilling the request.' },
  { code: 501, phrase: 'Not Implemented',                 desc: 'Server does not support the functionality required to fulfill the request.' },
  { code: 502, phrase: 'Bad Gateway',                     desc: 'Server, acting as a gateway, received an invalid response from the upstream server.' },
  { code: 503, phrase: 'Service Unavailable',             desc: 'Server is temporarily unable to handle the request due to overload or maintenance.' },
  { code: 504, phrase: 'Gateway Timeout',                 desc: 'Server, acting as a gateway, did not receive a timely response from an upstream server.' },
  { code: 505, phrase: 'HTTP Version Not Supported',      desc: 'Server does not support the HTTP version used in the request.' },
  { code: 506, phrase: 'Variant Also Negotiates',         desc: 'Transparent content negotiation for the request results in a circular reference.' },
  { code: 507, phrase: 'Insufficient Storage',            desc: 'Server is unable to store the representation needed to complete the request (WebDAV).' },
  { code: 508, phrase: 'Loop Detected',                   desc: 'Server detected an infinite loop while processing a request with Depth: infinity (WebDAV).' },
  { code: 510, phrase: 'Not Extended',                    desc: 'Further extensions to the request are required for the server to fulfill it.' },
  { code: 511, phrase: 'Network Authentication Required', desc: 'Client must authenticate to gain network access (captive portals).' },
];

const CATEGORIES = [
  { prefix: 1, label: '1xx — Informational', className: 'http-cat--1xx' },
  { prefix: 2, label: '2xx — Success',        className: 'http-cat--2xx' },
  { prefix: 3, label: '3xx — Redirection',    className: 'http-cat--3xx' },
  { prefix: 4, label: '4xx — Client Error',   className: 'http-cat--4xx' },
  { prefix: 5, label: '5xx — Server Error',   className: 'http-cat--5xx' },
];

// ── Render ────────────────────────────────────────────────────────────────────

function categoryClass(code) {
  const prefix = Math.floor(code / 100);
  const cat = CATEGORIES.find(c => c.prefix === prefix);
  return cat ? cat.className : '';
}

function render(query) {
  const q = query.trim().toLowerCase();
  const filtered = q
    ? CODES.filter(c =>
        String(c.code).includes(q) ||
        c.phrase.toLowerCase().includes(q) ||
        c.desc.toLowerCase().includes(q)
      )
    : CODES;

  httpList.innerHTML = '';

  // Update count (aria-live will announce this)
  const total = CODES.length;
  httpCount.textContent = q
    ? `${filtered.length} of ${total} codes`
    : `${total} codes`;

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'http-empty';
    empty.textContent = 'No matching codes.';
    httpList.appendChild(empty);
    return;
  }

  // Group by category
  for (const cat of CATEGORIES) {
    const group = filtered.filter(c => Math.floor(c.code / 100) === cat.prefix);
    if (group.length === 0) continue;

    const section = document.createElement('section');
    section.className = 'http-group';
    section.setAttribute('aria-label', cat.label);

    const heading = document.createElement('h3');
    heading.className = `http-group__label ${cat.className}`;
    heading.textContent = cat.label;
    section.appendChild(heading);

    const ul = document.createElement('ul');
    ul.className = 'http-code-list';

    for (const item of group) {
      const li = document.createElement('li');
      li.className = 'http-code-item';

      const badge = document.createElement('span');
      badge.className = `http-badge ${cat.className}`;
      badge.textContent = item.code;
      badge.setAttribute('aria-label', `HTTP ${item.code}`);

      const info = document.createElement('div');
      info.className = 'http-info';

      const phrase = document.createElement('span');
      phrase.className = 'http-phrase';
      phrase.textContent = item.phrase;

      const desc = document.createElement('span');
      desc.className = 'http-desc';
      desc.textContent = item.desc;

      info.appendChild(phrase);
      info.appendChild(desc);

      const copyBtn = document.createElement('button');
      copyBtn.className = 'btn btn--sm btn--ghost http-copy';
      copyBtn.textContent = 'Copy';
      copyBtn.setAttribute('aria-label', `Copy HTTP status code ${item.code}`);
      copyBtn.addEventListener('click', () => {
        copyText(String(item.code), copyBtn);
      });

      li.appendChild(badge);
      li.appendChild(info);
      li.appendChild(copyBtn);
      ul.appendChild(li);
    }

    section.appendChild(ul);
    httpList.appendChild(section);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────

render('');

httpSearch.addEventListener('input', () => render(httpSearch.value));
