const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const axios = require('axios')

require('dotenv').config()

app.locals.moment = require('moment')

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
)

app.use(express.static('public'))
app.use(require('./routes'))
app.set('view engine', 'pug')

app.listen(3000, () => {
  console.log('Server is running on 3000')
})
