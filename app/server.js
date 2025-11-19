// app/server.js
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Hello from CI/CD deployed app!'));
app.listen(port, () => console.log(`Server listening on ${port}`));
