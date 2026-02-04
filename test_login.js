
async function login() {
    try {
        const res = await fetch('http://127.0.0.1:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'jenilson@outlook.com.br',
                password: '125714Ab#'
            })
        });
        const data = await res.json();
        if (res.ok) {
            console.log(data.token);
        } else {
            console.error('Login failed:', data);
        }
    } catch (err) {
        console.error('Login error:', err.message);
    }
}

login();
