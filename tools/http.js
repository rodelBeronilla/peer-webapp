// HTTP Status Code Reference

const httpSearch  = document.getElementById('httpSearch');
const httpResults = document.getElementById('httpResults');
const httpStatus  = document.getElementById('httpStatus');

// ---------------------------------------------------------------------------
// Dataset — IANA-registered codes with short descriptions
// [code, name, description]
// ---------------------------------------------------------------------------
const CODES = [
  // 1xx — Informational
  [100, 'Continue',                      'The server received the request headers. Client should proceed to send the body.'],
  [101, 'Switching Protocols',           'Server is switching to the protocol specified in the Upgrade header.'],
  [102, 'Processing',                    'Server has received the request and is processing it; no response available yet.'],
  [103, 'Early Hints',                   'Used with Link header to let the browser preload resources before the final response.'],

  // 2xx — Success
  [200, 'OK',                            'Standard success response. The meaning depends on the HTTP method used.'],
  [201, 'Created',                       'Request succeeded and a new resource was created. Usually a response to POST.'],
  [202, 'Accepted',                      'Request received but not yet acted upon. Processing will happen asynchronously.'],
  [203, 'Non-Authoritative Information', 'Returned metadata is from a third-party mirror, not the origin server.'],
  [204, 'No Content',                    'Request succeeded. No body in response. Commonly used for DELETE or PUT.'],
  [205, 'Reset Content',                 'Request succeeded. Client should reset the document view (e.g. clear a form).'],
  [206, 'Partial Content',               'Partial GET request succeeded. Used when resuming downloads or range requests.'],
  [207, 'Multi-Status',                  'Multiple status codes for multiple independent operations (WebDAV).'],
  [208, 'Already Reported',              'Members of a DAV binding already enumerated in a previous reply (WebDAV).'],
  [226, 'IM Used',                       'Server fulfilled a GET request using instance manipulation (HTTP Delta encoding).'],

  // 3xx — Redirection
  [300, 'Multiple Choices',              'The request has more than one possible response. User or agent should choose one.'],
  [301, 'Moved Permanently',             'The URL has permanently changed. Future requests should use the new URL.'],
  [302, 'Found',                         'URI temporarily changed. Client should continue to use the original URL next time.'],
  [303, 'See Other',                     'Server directs client to GET the response from a different URL (often after POST).'],
  [304, 'Not Modified',                  'Response has not changed since last request. Client can use its cached version.'],
  [307, 'Temporary Redirect',            'Temporarily redirected. Client must use the same method and body as the original.'],
  [308, 'Permanent Redirect',            'Permanently redirected. Client must use the same method and body as the original.'],

  // 4xx — Client Errors
  [400, 'Bad Request',                   'Server cannot process the request due to client error (malformed syntax, etc.).'],
  [401, 'Unauthorized',                  'Client must authenticate to get the requested response. Authentication failed.'],
  [402, 'Payment Required',              'Reserved for future use. Sometimes used by APIs to indicate subscription required.'],
  [403, 'Forbidden',                     'Client is authenticated but does not have permission to access this resource.'],
  [404, 'Not Found',                     'Server cannot find the requested resource. URL may be wrong or resource deleted.'],
  [405, 'Method Not Allowed',            'The HTTP method is not supported for this endpoint. Check the Allow header.'],
  [406, 'Not Acceptable',                'Server cannot produce a response matching the Accept headers sent by the client.'],
  [407, 'Proxy Authentication Required', 'Authentication must be done via a proxy before the request can proceed.'],
  [408, 'Request Timeout',               'Server timed out waiting for the request. Client may resend the request.'],
  [409, 'Conflict',                      'Request conflicts with the current state of the resource (e.g. duplicate key).'],
  [410, 'Gone',                          'Resource permanently deleted. Unlike 404, this is definitive and intentional.'],
  [411, 'Length Required',               'Server requires the Content-Length header to be set on the request.'],
  [412, 'Precondition Failed',           'Client-specified precondition in headers was not met on the server side.'],
  [413, 'Content Too Large',             'Request body exceeds the server limit. The server may close the connection.'],
  [414, 'URI Too Long',                  'The URI is longer than the server is willing to process.'],
  [415, 'Unsupported Media Type',        'Media type of the request body is not supported. Check Content-Type header.'],
  [416, 'Range Not Satisfiable',         'The range specified in the Range header cannot be satisfied by the resource.'],
  [417, 'Expectation Failed',            'Server cannot meet the requirements of the Expect request header.'],
  [418, "I'm a Teapot",                  'Server refuses to brew coffee because it is a teapot. (RFC 2324, April Fools.)'],
  [421, 'Misdirected Request',           'Request was directed to a server unable to produce a response for that origin.'],
  [422, 'Unprocessable Content',         'Request is well-formed but contains semantic errors (e.g. validation failures).'],
  [423, 'Locked',                        'Resource being accessed is locked (WebDAV).'],
  [424, 'Failed Dependency',             'Request failed because a previous request it depended on also failed (WebDAV).'],
  [425, 'Too Early',                     'Server is unwilling to risk processing a request that might be replayed.'],
  [426, 'Upgrade Required',              'Server refuses to perform the request over the current protocol; client must upgrade.'],
  [428, 'Precondition Required',         'Origin server requires the request to be conditional to prevent lost updates.'],
  [429, 'Too Many Requests',             'Client has sent too many requests in a given time. See Retry-After header.'],
  [431, 'Request Header Fields Too Large','Server is unwilling to process the request because headers are too large.'],
  [451, 'Unavailable For Legal Reasons', 'Resource unavailable due to a legal demand (e.g. court order, DMCA notice).'],

  // 5xx — Server Errors
  [500, 'Internal Server Error',         'Server encountered an unexpected condition preventing it from fulfilling the request.'],
  [501, 'Not Implemented',               'The request method is not supported by the server and cannot be handled.'],
  [502, 'Bad Gateway',                   'Server acting as a gateway received an invalid response from an upstream server.'],
  [503, 'Service Unavailable',           'Server is not ready — overloaded or down for maintenance. Check Retry-After.'],
  [504, 'Gateway Timeout',               'Server acting as a gateway did not receive a response from upstream in time.'],
  [505, 'HTTP Version Not Supported',    'HTTP version used in the request is not supported by the server.'],
  [506, 'Variant Also Negotiates',       'Server has an internal configuration error: circular reference in content negotiation.'],
  [507, 'Insufficient Storage',          'Server cannot store the representation needed to complete the request (WebDAV).'],
  [508, 'Loop Detected',                 'Server detected an infinite loop while processing the request (WebDAV).'],
  [510, 'Not Extended',                  'Further extensions to the request are required before the server can fulfil it.'],
  [511, 'Network Authentication Required','Client needs to authenticate to gain network access (e.g. captive portals).'],
];

const CATEGORY = {
  1: { label: '1xx Informational', cls: 'http-badge--1xx' },
  2: { label: '2xx Success',       cls: 'http-badge--2xx' },
  3: { label: '3xx Redirect',      cls: 'http-badge--3xx' },
  4: { label: '4xx Client Error',  cls: 'http-badge--4xx' },
  5: { label: '5xx Server Error',  cls: 'http-badge--5xx' },
};

function categoryKey(code) { return Math.floor(code / 100); }

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------
function renderItem([code, name, desc]) {
  const cat = CATEGORY[categoryKey(code)];
  const li = document.createElement('li');
  li.className = 'http-item';
  li.innerHTML = `
    <span class="http-item__code">${code}</span>
    <span class="http-badge ${cat.cls}">${categoryKey(code)}xx</span>
    <span class="http-item__name">${name}</span>
    <span class="http-item__desc">${desc}</span>
    <button class="btn btn--sm btn--ghost http-item__copy" aria-label="Copy status code ${code}">Copy</button>
  `;
  li.querySelector('.http-item__copy').addEventListener('click', (e) => {
    navigator.clipboard.writeText(String(code)).then(() => {
      const btn = e.currentTarget;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
    });
  });
  return li;
}

function renderGrouped() {
  const frag = document.createDocumentFragment();
  const groups = [1, 2, 3, 4, 5];
  for (const g of groups) {
    const items = CODES.filter(([c]) => categoryKey(c) === g);
    const section = document.createElement('li');
    section.className = 'http-group';
    const header = document.createElement('h3');
    header.className = 'http-group__header';
    header.textContent = CATEGORY[g].label;
    section.appendChild(header);
    const ul = document.createElement('ul');
    ul.className = 'http-group__list';
    for (const item of items) ul.appendChild(renderItem(item));
    section.appendChild(ul);
    frag.appendChild(section);
  }
  return frag;
}

function renderSearch(query) {
  const q = query.toLowerCase().trim();
  const matches = CODES.filter(([code, name, desc]) =>
    String(code).startsWith(q) ||
    name.toLowerCase().includes(q) ||
    desc.toLowerCase().includes(q)
  );
  const frag = document.createDocumentFragment();
  if (matches.length === 0) {
    const li = document.createElement('li');
    li.className = 'http-empty';
    li.textContent = `No status codes match "${query}"`;
    frag.appendChild(li);
  } else {
    for (const item of matches) frag.appendChild(renderItem(item));
  }
  return frag;
}

// ---------------------------------------------------------------------------
// Update display
// ---------------------------------------------------------------------------
function update() {
  const q = httpSearch.value.trim();
  httpResults.innerHTML = '';
  if (q) {
    httpResults.appendChild(renderSearch(q));
    const count = httpResults.querySelectorAll('.http-item').length;
    httpStatus.textContent = count > 0 ? `${count} result${count !== 1 ? 's' : ''}` : '';
    httpStatus.className = 'status-bar' + (count > 0 ? ' status-bar--ok' : '');
  } else {
    httpResults.appendChild(renderGrouped());
    httpStatus.textContent = `${CODES.length} status codes`;
    httpStatus.className = 'status-bar status-bar--ok';
  }
}

httpSearch.addEventListener('input', update);

// Initial render
update();
