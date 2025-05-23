import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
    itemCategory: {
        type: String,
        required: true,
        enum: ['Tools', 'Reusable', 'Consumable'],
      },
      itemSubCategory: {
        type: String,
        required: true,
      },
      itemType: {
        type: String,
        required: false,
      },
      pricePerItem: {
        type: Number,
        required: true,
      },
    itemName: {
        type: String,
        required: true,
    },
    fromSite: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkSite',
        default: null,
    },
    workSiteId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WorkSite',
        default: null,
    },
    workSite: {
        type: String,
        required: false,
        default: null,
      },
    quantity: {
        type: Number,
        required: true,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
    image: {
        type: String,
        required: false,
        default: null,
    },
    date: {
        type: Date,
        default: Date.now,
      },
}, { timestamps: true });

const Item = mongoose.model("Item", itemSchema);
export default Item;
