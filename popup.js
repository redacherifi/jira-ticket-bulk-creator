// Popup script for Jira Bulk Create - updated: required fields + view custom fields
const jiraUrlInput = document.getElementById('jiraUrlInput');
const emailInput = document.getElementById('emailInput');
const tokenInput = document.getElementById('tokenInput');
const epicInput = document.getElementById('epicInput');
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const viewFieldsBtn = document.getElementById('viewFieldsBtn');
const customFieldsDiv = document.getElementById('customFields');
const log = document.getElementById('log');

function setLog(text, append=false){
  if(append) {
    log.textContent += '\n' + text;
  } else {
    log.textContent = text;
  }
}

// Basic validation for required fields
function validateRequired(){
  if (!jiraUrlInput.value.trim()) { setLog('JIRA_URL is required'); return false; }
  if (!emailInput.value.trim()) { setLog('JIRA_EMAIL is required'); return false; }
  if (!tokenInput.value.trim()) { setLog('JIRA_TOKEN is required'); return false; }
  if (!fileInput.files.length) { setLog('Please select a JSON file'); return false; }
  return true;
}

viewFieldsBtn.addEventListener('click', async () => {
  setLog('');
  customFieldsDiv.style.display = 'none';
  if (!jiraUrlInput.value.trim() || !emailInput.value.trim() || !tokenInput.value.trim()) {
    return setLog('Please fill JIRA_URL, email and token first to fetch fields.');
  }
  const url = jiraUrlInput.value.replace(/\/$/,'') + '/rest/api/3/field';
  setLog('Fetching custom fields...');
  try {
    const auth = btoa(`${emailInput.value.trim()}:${tokenInput.value.trim()}`);
    const resp = await fetch(url, { headers: { 'Authorization': 'Basic ' + auth, 'Accept': 'application/json' } });
    if (!resp.ok) {
      const txt = await resp.text();
      return setLog('Error fetching fields: ' + resp.status + ' ' + txt);
    }
    const fields = await resp.json();
    customFieldsDiv.innerHTML = '';
    if (!Array.isArray(fields) || fields.length === 0) {
      customFieldsDiv.textContent = 'No fields returned.';
    } else {
      for (let f of fields) {
        const div = document.createElement('div');
        div.className = 'field-item';
        div.textContent = `${f.id} — ${f.name} (${f.schema && f.schema.type ? f.schema.type : 'n/a'})`;
        customFieldsDiv.appendChild(div);
      }
      customFieldsDiv.style.display = 'block';
    }
    setLog('Fetched ' + fields.length + ' fields.', true);
  } catch (err) {
    setLog('Error fetching fields: ' + err);
  }
});

uploadBtn.addEventListener('click', async () => {
  setLog('');
  customFieldsDiv.style.display = 'none';

  if (!validateRequired()) return;

  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!Array.isArray(data)) {
        setLog('JSON file should contain an array of issues (tickets).');
        return;
      }
      const baseUrl = jiraUrlInput.value.replace(/\/$/,''); // remove trailing slash
      const auth = btoa(`${emailInput.value.trim()}:${tokenInput.value.trim()}`);
      let count = 0;
      for (const ticket of data) {
        const EPIC_KEY = epicInput.value.trim();
        const projectKey = EPIC_KEY.split('-')[0];

        const body = {
          fields: {
            project: { key: projectKey },
            summary: ticket.summary,
            description: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: ticket.description }
                  ]
                }
              ]
            },
            issuetype: { name: 'Story' },
            customfield_10007: EPIC_KEY, // Epic Link field (adjust if your Jira uses a different one)
          }
        };

        const resp = await fetch(baseUrl + '/rest/api/3/issue', {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + auth,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        });

        const text = await resp.text();
        if (resp.ok) {
          setLog(`Created: ${text}`, true);
        } else {
          setLog(`Error creating issue (${resp.status}): ${text}`, true);
        }
        count++;
      }
      setLog(`\n✅ Done. Processed ${count} tickets.`, true);
    } catch (err) {
      setLog('Error parsing JSON or creating tickets: ' + err);
    }
  };
  reader.readAsText(file);
});
