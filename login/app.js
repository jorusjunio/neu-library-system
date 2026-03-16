// login/app.js — NEU Library Login Page

const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'unauthorized') {
  document.getElementById('errorMsg').style.display = 'block';
}