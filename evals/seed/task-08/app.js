// Monolithic user-list app. Fetches users, parses the response shape, and renders a list.
// Refactor target: split fetch / parse / render into three single-responsibility modules.

const API_URL = 'https://jsonplaceholder.typicode.com/users';

async function run() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const rawData = await response.json();

    // Transform: map API shape into our internal user objects.
    const users = rawData.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      company: u.company ? u.company.name : 'Unknown',
      city: u.address ? u.address.city : 'Unknown',
      phone: u.phone ? u.phone.split(' ')[0] : '',
      website: u.website || '',
    }));

    // Filter: only users with a plausibly valid email.
    const validUsers = users.filter((u) => u.email && u.email.includes('@'));

    // Sort: alphabetical by name.
    validUsers.sort((a, b) => a.name.localeCompare(b.name));

    // Stats: computed before render so header can show count.
    const stats = {
      total: validUsers.length,
      uniqueCompanies: new Set(validUsers.map((u) => u.company)).size,
      uniqueCities: new Set(validUsers.map((u) => u.city)).size,
    };

    // Render: build DOM under #user-list.
    const container = document.getElementById('user-list');
    if (!container) {
      throw new Error('No user-list container in the page');
    }
    container.innerHTML = '';

    const header = document.createElement('h1');
    header.textContent = `Users (${stats.total})`;
    container.appendChild(header);

    const meta = document.createElement('p');
    meta.className = 'meta';
    meta.textContent = `${stats.uniqueCompanies} companies across ${stats.uniqueCities} cities`;
    container.appendChild(meta);

    const list = document.createElement('ul');
    list.className = 'users';

    validUsers.forEach((user) => {
      const item = document.createElement('li');
      item.className = 'user';

      const name = document.createElement('h3');
      name.textContent = user.name;
      item.appendChild(name);

      const details = document.createElement('div');
      details.className = 'details';

      const email = document.createElement('p');
      email.textContent = `Email: ${user.email}`;
      details.appendChild(email);

      const company = document.createElement('p');
      company.textContent = `Company: ${user.company}`;
      details.appendChild(company);

      const city = document.createElement('p');
      city.textContent = `City: ${user.city}`;
      details.appendChild(city);

      const phone = document.createElement('p');
      phone.textContent = `Phone: ${user.phone}`;
      details.appendChild(phone);

      if (user.website) {
        const website = document.createElement('a');
        website.href = `https://${user.website}`;
        website.textContent = user.website;
        website.target = '_blank';
        website.rel = 'noopener';
        details.appendChild(website);
      }

      item.appendChild(details);
      list.appendChild(item);
    });

    container.appendChild(list);
  } catch (err) {
    console.error('Failed to load users:', err);
    const container = document.getElementById('user-list');
    if (container) {
      container.innerHTML = `<p class="error">Failed to load users: ${err.message}</p>`;
    }
  }
}

run();
