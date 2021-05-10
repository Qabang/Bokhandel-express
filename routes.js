const router = require('express').Router()
const serverConfig = require('./server.js')
const sql = require('mssql')

const validateForm = (req, res, next) => {
  let error = []
  const { Titel, Pris, Utgivningsdatum, författare } = req.body

  if (!Titel || Titel === '') {
    error.push({ name: 'Titel', msg: 'Titel får inte vara tomt' })
  }
  if (!författare) {
    error.push({
      name: 'Författare',
      msg: 'Boken måste ha minst en författare',
    })
  }
  if (Pris < 0) {
    error.push({ name: 'Pris', msg: 'Priset får inte vara lägre än 0 kr' })
  }
  if (new Date(Utgivningsdatum).getTime() > new Date().getTime()) {
    error.push({
      name: 'Utgivningsdatum',
      msg: 'Datumet kan inte vara i framtiden',
    })
  }
  req.error = error
  next()
}

// router.use(validateForm)

const httpStatus = {
  404: {
    statusName: 'Page not found.',
    message: "Oops! You are trying to access a page that dosen't exists.",
    status: 404,
  },
  503: {
    statusName: 'Service Unavailable',
    message: 'Sorry the server is currently unavailable',
    status: 503,
  },
}

router.get('/', async (req, res) => {
  let orderBy = 'Titel'

  switch (req.query.orderBy) {
    case 'ISBN13':
      orderBy = 'ISBN13'
      break
    case 'Titel':
      orderBy = 'Titel'
      break
    case 'Författare':
      orderBy = 'Författare'
      break
    case 'Pris':
      orderBy = 'Pris'
      break
    default:
      orderBy = 'Titel'
      break
  }

  let query = `
        SELECT b.ISBN13, b.Titel, f.Förnamn + ' ' + f.efternamn AS Författare, b.Pris from författare f
        inner join FörfattareBöckerRelation r on f.FörfattarID = r.FörfattarID
		    inner join böcker b on r.ISBN13 = b.ISBN13
        ORDER BY
          case @ORDERBY When 'ISBN13' THEN b.ISBN13 END,
          case @ORDERBY When 'Pris' THEN b.Pris END,
          case @ORDERBY When 'Titel' THEN b.Titel END,
          case @ORDERBY When 'Författare' THEN f.Förnamn + ' ' + f.efternamn END
        `

  //
  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection
      .request()
      .input('ORDERBY', sql.NVarChar, orderBy)
      .query(query)

    res.render('index', {
      bookAuthors: result.recordsets[0],
      orderBy: orderBy,
    })
  } catch (error) {
    console.error(error.message)
    res.status(503).render('error', httpStatus[503])
  }
})

router.get('/authors', async (req, res) => {
  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection.request().query('select * from Författare')

    res.render('authors', { authors: result.recordset })
  } catch (error) {
    console.error(error.message)
    res.status(503).render('error', httpStatus[503])
  }
})

router.get('/authors/:id', async (req, res) => {
  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection
      .request()
      .input('id', sql.Int, req.params.id)
      .query(`select f.Förnamn + ' ' + f.Efternamn AS namn, b.Titel,b.ISBN13 from Författare f
      inner join FörfattareBöckerRelation r ON r.FörfattarID = f.författarID 
      inner join böcker b ON r.ISBN13 = b.ISBN13
      Where f.författarID = @id
      order by Titel`)

    res.render('books-author', { authors: result.recordset })
  } catch (error) {
    console.error(error.message)
    res.status(503).render('error', httpStatus[503])
  }
})

router.get('/stores', async (req, res) => {
  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection.request().query('select * from Butiker')

    res.render('stores', { stores: result.recordset })
  } catch (error) {
    console.error(error.message)
    res.status(503).render('error', httpStatus[503])
  }
})

router.get('/book/:id', async (req, res) => {
  let saved = {
    success: req.query.saved,
    msg: '',
  }
  if (saved.success === 'true') {
    saved.msg = 'Ändringarna har sparats'
  }

  if (saved.success === 'error') {
    saved.msg = 'Någonting gick fel! Inga ändringar har sparats'
  }

  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection
      .request()
      .input('id', sql.NVarChar, req.params.id).query(`select 
          b.ISBN13,
          b.titel,
          b.språk,
          b.pris,
          b.utgivningsdatum,
          k.kategori,
          f.förnamn + ' ' + f.efternamn AS Författare
        from böcker b
        inner join FörfattareBöckerRelation r on b.ISBN13 = r.ISBN13
        inner join författare f on r.författarID = f.författarID
        inner join Kategorier k on b.KategoriID = k.KategoriID
        Where b.isbn13 = + @id;
                
        Select b.butiksnamn, l.antal, b.hemsida from butiker b
        inner join Lagersaldo l on b.ButikID = l.ButikID
        group by b.ButikID, b.Butiksnamn, l.isbn13, l.Antal,b.hemsida
        having l.isbn13 = + @id`)

    if (result.recordset.length > 0) {
      let error = req.query.error ? JSON.parse(req.query.error) : false
      res.render('book', {
        book: result.recordsets[0][0],
        authors: result.recordsets[0],
        stores: result.recordsets[1],
        imgSrc:
          'https://image.bokus.com/images/' + result.recordsets[0][0].ISBN13,
        saved: saved,
        error: error,
      })
    } else {
      res.status(404).render('error', httpStatus[404])
    }
  } catch (error) {
    console.error(error)
    res.status(503).render('error', httpStatus[503])
  }
})

router.get('/book/:id/edit', async (req, res) => {
  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection
      .request()
      .input('id', sql.NVarChar, req.params.id).query(`select 
          b.ISBN13,
          b.titel,
          b.språk,
          b.pris,
          b.utgivningsdatum,
          k.kategori,
          f.förnamn + ' ' + f.efternamn AS Författare,
          f.författarID
        from böcker b
        inner join FörfattareBöckerRelation r on b.ISBN13 = r.ISBN13
        inner join författare f on r.författarID = f.författarID
        inner join Kategorier k on b.KategoriID = k.KategoriID
        WHERE b.isbn13 = + @id;

        select * from kategorier;

        select distinct  f.FörfattarID, f.förnamn + ' ' + f.efternamn AS namn from Författare f
	      left join FörfattareBöckerRelation r on r.FörfattarID = f.FörfattarID
      	where r.ISBN13 is NULL OR r.isbn13 <> + @id
        order by namn asc;

        `)

    if (result.recordset.length > 0) {
      res.render('book-edit', {
        book: result.recordsets[0][0],
        bookAuthors: result.recordsets[0],
        category: result.recordsets[1],
        authors: result.recordsets[2],
        imgSrc: 'https://image.bokus.com/images/' + result.recordset.ISBN13,
        error: req.query.error ? JSON.parse(req.query.error) : false,
      })
    } else {
      res.status(404).render('error', httpStatus[404])
    }
  } catch (error) {
    console.error(error)
    res.status(503).render('error', httpStatus[503])
  }
})

router.post('/book/:id/edit', validateForm, async (req, res) => {
  let originalData
  let newData = req.body
  let error = req.error

  let query = `select 
          b.ISBN13,
          b.titel,
          b.språk,
          b.pris,
          b.utgivningsdatum,
          k.kategori,
          f.författarID
        from böcker b
        inner join FörfattareBöckerRelation r on b.ISBN13 = r.ISBN13
        inner join författare f on r.författarID = f.författarID
        inner join Kategorier k on b.KategoriID = k.KategoriID
        WHERE b.isbn13 = + @id;
        `

  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection
      .request()
      .input('id', sql.NVarChar, req.params.id)
      .query(query)

    if (result.recordset.length > 0) {
      originalData = result.recordset

      if (error.length === 0) {
        // Delete old authors from book.
        for (let i = 0; i < originalData.length; i++) {
          const author = originalData[i]
          try {
            const result = await connection
              .request()
              .input('authorId', sql.Int, author.författarID)
              .input('id', sql.NVarChar, req.params.id).query(`
                Delete from FörfattareBöckerRelation
                WHERE ISBN13 = @id AND FörfattarID = @authorId
                `)
          } catch (e) {
            console.error(e)
            res.redirect(/book/ + req.params.id + '?saved=error')
          }
        }

        // Insert new authors.
        if (newData.författare.length > 0) {
          for (let i = 0; i < newData.författare.length; i++) {
            try {
              const element = newData.författare[i]
              const result = await connection
                .request()
                .input('id', sql.NVarChar, req.params.id)
                .input('authorId', sql.Int, element).query(`
                    insert into FörfattareBöckerRelation(isbn13, författarID)
                      values(@id, @authorId)
                    `)
            } catch (e) {
              console.error(e)
              res.redirect(/book/ + req.params.id + '?saved=error')
            }
          }
        } else {
          try {
            const result = await connection
              .request()
              .input('authorId', sql.Int, newData.författare)
              .input('id', sql.NVarChar, req.params.id).query(`
              Update FörfattareBöckerRelation
                SET
                FörfattarID = @authorId,
                ISBN13 = @id
              WHERE ISBN13 = @id AND FörfattarID = ${originalData[0].författarID}
              `)
          } catch (e) {
            console.error(e)
            res.redirect(/book/ + req.params.id + '?saved=error')
          }
        }
      }

      if (error.length === 0) {
        try {
          const result = await connection
            .request()
            .input('id', sql.NVarChar, req.params.id)
            .input('titel', sql.NVarChar, newData.Titel)
            .input('lang', sql.NVarChar, originalData[0]['språk'])
            .input('pris', sql.Float, newData.Pris)
            .input('kategori', sql.NVarChar, newData.Kategori)
            .input('datum', sql.Date, newData.Utgivningsdatum)
            .query(
              `Update böcker 
                SET
                  ISBN13 = @id,
                  titel = @titel,
                  språk = @lang,
                  pris = @pris,
                  utgivningsdatum = CAST(@datum AS DATETIME),
                  kategoriID = @kategori
                FROM böcker b
              WHERE b.isbn13 = + @id; 
            `
            )

          res.redirect(/book/ + req.params.id + '?saved=true')
        } catch (e) {
          res.redirect(/book/ + req.params.id + '?saved=error')
        }
      }
    }
  } catch (error) {
    console.error(error)
    res.status(503).render('error', httpStatus[503])
  }
  if (error.length > 0) {
    res.redirect(
      /book/ +
        req.params.id +
        '/edit?saved=error&error=' +
        JSON.stringify(error)
    )
  }
})

router.delete('/book/:id/edit', async (req, res) => {
  try {
    const connection = await sql.connect(serverConfig)
    const result = await connection
      .request()
      .input('id', sql.NVarChar, req.params.id).query(`
      DELETE FROM FörfattareBöckerRelation WHERE isbn13 = + @id
      DELETE FROM Lagersaldo WHERE isbn13 = + @id;
      DELETE FROM Böcker WHERE isbn13 = + @id;
      `)
    if (result) {
      res.send({ deleted: 'Successfully Deleted', id: req.params.id })
    }
  } catch (error) {
    console.error(error)
    res.status(503).render('error', httpStatus[503])
  }
})

// Display 404 on all routes that don't match any of the routes above.
router.get('*', (req, res) => {
  res.status(404).render('error', httpStatus[404])
})

module.exports = router
