const express = require('express');
const router = express.Router();
const { createQuote, getQuotes, getQuoteById, updateQuote, deleteQuote } = require('../controllers/quoteController');
// Route to create a new quote
router.post('/', createQuote);

// Route to get all quotes
router.get('/', getQuotes);

// Route to get a quote by ID
router.get('/:id', getQuoteById);

// Route to update a quote
router.put('/:id', updateQuote);

// Route to delete a quote
router.delete('/:id', deleteQuote);

module.exports = router;