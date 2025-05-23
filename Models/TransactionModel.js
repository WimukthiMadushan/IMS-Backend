import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema({
    itemId: {
        type: String,
        required: false,
    },
    itemName: {
        type: String,
        required: false,
    },
    userId: {
        type: String,
        required: true,
    },
    quantity: {
        type: Number,
        required: false,
    },
    fromSite: {
        type: String,
        required: false,
    },
    toSite: {
        type: String,
        required: false,
    },
    description: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;