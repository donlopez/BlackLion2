const table = document.getElementById('table1');
const url = 'https://api.twilio.com/2010-04-01/Accounts/??/Messages.json';

async function loadTable(url, table) {
  const tableHead = table.querySelector('thead');
  const tableBody = table.querySelector('tbody');

  const myHeaders = new Headers();
  myHeaders.append('Authorization', 'Basic ');

  const formdata = new FormData();

  const requestOptions = {
    method: 'GET',
    headers: myHeaders,
    redirect: 'follow'
  };

  try {
    const response = await fetch(url, requestOptions);
    const result = await response.json();

    // Clear existing table content
    tableHead.innerHTML = '';
    tableBody.innerHTML = '';

    // Create table headers
    const headerRow = document.createElement('tr');
    const headers = ['Date', 'Time', 'To', 'Body', 'Status'];

    headers.forEach((header) => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });

    tableHead.appendChild(headerRow);

    // Populate table rows with data
    result.messages.forEach((message) => {
      const row = document.createElement('tr');

      const dateSent = new Date(message.date_sent);
      const formattedDate = dateSent.toLocaleDateString();
      const formattedTime = dateSent.toLocaleTimeString([], { hour: 'numeric', minute: 'numeric' });

      const dateCell = document.createElement('td');
      dateCell.textContent = formattedDate;
      row.appendChild(dateCell);

      const timeCell = document.createElement('td');
      timeCell.textContent = formattedTime;
      row.appendChild(timeCell);

      const toCell = document.createElement('td');
      toCell.textContent = message.to;
      row.appendChild(toCell);

      const bodyCell = document.createElement('td');
      bodyCell.textContent = message.body;
      row.appendChild(bodyCell);

      const statusCell = document.createElement('td');
      statusCell.textContent = message.status;
      row.appendChild(statusCell);

      tableBody.appendChild(row);
    });
  } catch (error) {
    console.log('error', error);
  }
}

document.getElementById('table-button').addEventListener('click', () => {
  loadTable(url, table);
});

loadTable(url, table);
