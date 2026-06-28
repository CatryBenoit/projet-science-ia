import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:3001/api', // L'adresse de ton Backend Node.js
    withCredentials: true // INDISPENSABLE pour que la session (login) fonctionne !
});

export default api;