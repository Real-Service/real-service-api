const Quote = require('../models/Quote');

// Controller function to create a new quote
const createQuote = async (req, res) => {
    try {
        const quote = new Quote(req.body);
        await quote.save();
        res.status(201).json(quote);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Controller function to get all quotes
const getQuotes = async (req, res) => {
    try {
        const quotes = await Quote.find();
        res.json(quotes);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Controller function to get a quote by ID
const getQuoteById = async (req, res) => {
    try {
        const quote = await Quote.findById(req.params.id);
        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }
        res.json(quote);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Controller function to update a quote
const updateQuote = async (req, res) => {
    try {
        const quote = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }
        res.json(quote);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Controller function to delete a quote
const deleteQuote = async (req, res) => {
    try {
        const quote = await Quote.findByIdAndDelete(req.params.id);
        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }
        res.json({ message: 'Quote deleted' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = { createQuote, getQuotes, getQuoteById, updateQuote, deleteQuote };