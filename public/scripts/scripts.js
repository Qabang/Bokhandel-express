/**
 * Function that redirect to the page of the book where the isbn13 = id.
 * @param {string} id
 */
function goTo(id) {
  window.location.href = window.location.origin + '/book/' + id
}

/**
 * Function that redirect to the page of the author.
 * @param {string} id
 */
function goToAuthor(id) {
  window.location.href = window.location.origin + '/authors/' + id
}

/**
 * Function that redirects to the editpage of a book.
 */
function editBook(id) {
  window.location.href = window.location.origin + '/book/' + id + '/edit'
}

/**
 * function that adds url parameter so that the table can be sorted.
 * @param {string} attr
 */
function sortTable(attr) {
  let oldActive = document.querySelector('.active')
  if (oldActive) {
    oldActive.classList.remove('active')
  }
  let elem = document.getElementById(attr)
  if (elem) {
    elem.classList.add('active')
  }
  window.location.href = '/?orderBy=' + attr
}

/**
 * Function that makes a delete request to the same url that is been called from. If user confirms the delete we delete the item from database otherwise we do nothing.
 */
async function deleteBook() {
  let deleteItem = confirm(
    'Boken kommer att raderas och detta går inte att ångra. är du säker på att du vill fortsätta?'
  )
  // If user input is true we make the delete request.
  if (deleteItem) {
    let url = window.location.href
    await fetch(url, {
      method: 'DELETE',
    })
      .then((response) => response.json())
      .then((result) => {
        // We have made a successful delete request and deleted the book from the database. Now we want to redirect the user to /.
        if (result.deleted === 'Successfully Deleted') {
          alert(
            'Boken med ISBN13 = ' + result.id + ' har tagits bort ur databasen'
          )
          window.location.href = window.location.origin + '/'
        }
      })
  }
}
