const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = envContent.split('\n').reduce((acc, line) => {
    const split = line.split('=');
    if (split.length >= 2) {
        acc[split[0].trim()] = split.slice(1).join('=').trim();
    }
    return acc;
}, {});

fetch(`${env.VITE_SUPABASE_URL}/rest/v1/?apikey=${env.VITE_SUPABASE_ANON_KEY}`)
    .then(res => res.json())
    .then(data => {
        const billsDef = data.definitions.bills.properties;
        console.log(Object.keys(billsDef));
    })
    .catch(err => console.error(err));
