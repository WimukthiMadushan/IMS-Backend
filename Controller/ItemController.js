import Item from "../Models/Item.js";
import Transaction from "../Models/TransactionModel.js";
import WorkSite from "../Models/WorkSitesModel.js";
import User from "../Models/UserModel.js";
import mongoose from "mongoose";
import { writeToItemSheet, appendInventoryUpdateRow, deleteItemSheet,recordItemTransferInSheet } from './../Services/googleSheetService.js';
import { format } from 'date-fns';

export const GetItems = async (req, res) => {
  try {
    const uniqueItems = await Item.aggregate([
      {
        $group: {
          _id: "$itemName",
          doc: { $first: "$$ROOT" } 
        }
      },
      {
        $replaceRoot: { newRoot: "$doc" }
      },
      {
        $sort: { itemName: 1 }
      }
    ]);

    res.status(200).json(uniqueItems);
  } catch (err) {
    res.status(500).json({ message: "Error retrieving unique items", error: err.message });
  }
};
export const GetAllItems = async (req, res) => { }

export const GetItemsQuantity = async (req, res) => {
  try {
    const result = await Item.aggregate([
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" }
        }
      }
    ]);

    const totalQuantity = result.length > 0 ? result[0].totalQuantity : 0;

    res.status(200).json({ totalQuantity });
  } catch (err) {
    res.status(500).json({
      message: "Error retrieving total quantity",
      error: err.message,
    });
  }
};
export const GetUniqueItemCount = async (req, res) => {
  try {
    const result = await Item.aggregate([
      {
        $group: {
          _id: "$itemName"
        }
      },
      {
        $count: "uniqueItemCount"
      }
    ]);

    const count = result.length > 0 ? result[0].uniqueItemCount : 0;

    res.status(200).json({ uniqueItemCount: count });
  } catch (err) {
    res.status(500).json({
      message: "Error counting unique items",
      error: err.message,
    });
  }
};
export const getItemsInTheTrash = async (req, res) => {
  const { id } = req.params;
  try {
    const objectId = new mongoose.Types.ObjectId(id);
    console.log("Object ID:", objectId);
    const result = await Item.aggregate([
      { $match: { workSiteId: objectId } },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" }
        }
      }
    ]);

    const totalQuantity = result[0]?.totalQuantity || 0;

    res.status(200).json({ totalQuantity });
  } catch (err) {
    res.status(500).json({
      message: "Error calculating total quantity in trash",
      error: err.message
    });
  }
};
export const getItemsIntheRepair = async (req, res) => {
  const { id } = req.params;
  try {
    const objectId = new mongoose.Types.ObjectId(id);
    const result = await Item.aggregate([
      { $match: { workSiteId: objectId } },
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: "$quantity" }
        }
      }
    ]);

    const totalQuantity = result[0]?.totalQuantity || 0;

    res.status(200).json({ totalQuantity });
  } catch (err) {
    res.status(500).json({
      message: "Error calculating total quantity in trash",
      error: err.message
    });
  }
};
    
export const AddItem = async (req, res) => {
  try {
    const newItem = new Item(req.body);
    const savedItem = await newItem.save();

    res.status(201).json(savedItem);

    // Handle transaction and Google Sheet for MAIN item
    try {
      const [workSite, user, allSites] = await Promise.all([
        WorkSite.findById(savedItem.workSiteId).lean(),
        User.findById(req.body.userId).lean(),
        WorkSite.find().lean(),
      ]);

      const workSiteName = workSite?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";
      const siteNames = allSites.map(site => site.workSiteName);

      const transaction = new Transaction({
        itemId: savedItem._id.toString(),
        itemName: savedItem.itemName,
        userId: req.body.userId,
        quantity: savedItem.quantity,
        toSite: savedItem.workSiteId,
        description: `"${savedItem.itemName}" added to "${workSiteName}" by "${userName}"`,
      });

      await transaction.save();

      const now = new Date();
      const dateStr = format(now, 'yyyy-MM-dd');
      const timeStr = format(now, 'HH:mm:ss');

      const filteredSiteNames = siteNames.filter(name => name !== 'Store Room');
      const siteQuantities = filteredSiteNames.map(() => 0);
      const dataRow = [dateStr, timeStr, savedItem.quantity, ...siteQuantities];

      await writeToItemSheet(savedItem.itemName, dataRow, true, siteNames);
    } catch (txnErr) {
      console.error("Transaction save failed:", txnErr.message);
    }
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Error adding item", error: error.message });
  }
};
export const GetItemsBySiteId = (req, res) => { 
    // Get items by worksite ID from the database
    const workSiteId = req.params.id;
    console.log('Worksite ID:', workSiteId);
    if (!workSiteId) {
        return res.status(400).json({ message: "Worksite ID is required" });
    }
    Item.find({ workSiteId })
        .then(items => {
            res.status(200).json(items);
        })
        .catch(err => {
            res.status(500).json({ message: "Error retrieving items", error: err });
        });
}
export const GetItemsByName = async (req, res) => {
    // Get items by name from the database
    const { name } = req.query;
    console.log('Name query parameter:', name);
    if (!name) {
        return res.status(400).json({ message: "Name query parameter is required" });
    }
    try {
        const items = await Item.find({
            itemName: { $regex: name, $options: "i" }
        });
        res.status(200).json(items);
    } catch (error) {
        console.error("Error fetching items by name:", error);
        res.status(500).json({ message: "Error fetching items", error: error.message });
    }
};
export const EditItem = async (req, res) => {
    const itemId = req.params.id;
    try {
    const updatedItem = await Item.findByIdAndUpdate(itemId, req.body, {
      new: true,
    });

    if (!updatedItem) {
      return res.status(404).json({ message: "Item not found" });
    }
    // Send response immediately
    res.status(200).json(updatedItem);

    // Background transaction creation
    try {
      const [workSite, user] = await Promise.all([
        WorkSite.findById(req.body.worksiteId).lean(),
        User.findById(req.body.userId).lean(),
      ]);

      const workSiteName = workSite?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        itemId: updatedItem._id.toString(),
        itemName: updatedItem.itemName,
        fromSite: updatedItem.workSiteId,
        userId: req.body.userId,
        quantity: updatedItem.quantity,
        description: `"${updatedItem.itemName}" in the "${workSiteName}" updated by "${userName}" with new quantity: ${updatedItem.quantity} and Item Name: ${updatedItem.itemName}`,
      });

      await transaction.save();

      if (updatedItem.quantity !== oldQuantity) {
        const now = new Date();
        const dateStr = format(now, 'yyyy-MM-dd');
        const timeStr = format(now, 'HH:mm:ss');

        const siteNames = allSites.map(site => site.workSiteName).slice(1); // Exclude 'Main Inventory'
        await appendInventoryUpdateRow(updatedItem.itemName, updatedItem.quantity, siteNames);
      }

    } catch (txnErr) {
      console.error("Transaction logging failed:", txnErr.message);
    }

  } catch (err) {
    console.error("Error updating item:", err.message);
    res.status(500).json({ message: "Error updating item", error: err.message });
  }
};
export const DeleteItem = async (req, res) => {
  const itemId = req.params.id;

  try {
    const deletedItem = await Item.findByIdAndDelete(itemId);

    if (!deletedItem) {
      return res.status(404).json({ message: "Item not found" });
    }

    // Respond to client immediately
    res.status(200).json({ message: "Item deleted successfully" });

    // Background transaction logging
    try {
      const [workSite, user] = await Promise.all([
        WorkSite.findById(req.body.worksiteId).lean(),
        User.findById(req.body.userId).lean(),
      ]);

      const workSiteName = workSite?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        itemId: deletedItem._id.toString(),
        fromSite: deletedItem.workSiteId,
        userId: req.body.userId,
        description: `"${deletedItem.itemName}" deleted from "${workSiteName}" by "${userName}"`,
      });

      await transaction.save();

      await deleteItemSheet(deletedItem.itemName);
    } catch (txnErr) {
      console.error("Transaction logging failed:", txnErr.message);
    }

  } catch (err) {
    console.error("Error deleting item:", err.message);
    res.status(500).json({ message: "Error deleting item", error: err.message });
  }
};
export const IncreaseQuantity = async (req, res) => {
  const { itemId, quantity, userId } = req.body;

  if (!itemId || !quantity || !userId) {
    return res.status(400).json({ message: "Item ID, quantity, and user ID are required" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    item.quantity += quantity;
    item.lastUpdated = new Date();

    const updatedItem = await item.save();

    // Send response first
    res.status(200).json({
      message: "Quantity increased successfully",
      item: updatedItem
    });

    // Transaction logging in background
    try {
      const [workSite, user] = await Promise.all([
        WorkSite.findById(updatedItem.workSiteId).lean(),
        User.findById(userId).lean(),
      ]);

      const workSiteName = workSite?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        itemId: updatedItem._id.toString(),
        itemName: updatedItem.itemName,
        userId: userId,
        quantity: quantity,
        fromSite: updatedItem.workSiteId,
        description: `"${quantity}" units added to "${updatedItem.itemName}" at "${workSiteName}" by "${userName}"`,
      });

      await transaction.save();

      try {
        const siteNames = await WorkSite.find()
              .lean()
              .then(sites => sites.map(s => s.workSiteName).slice(1));

        await appendInventoryUpdateRow(updatedItem.itemName, updatedItem.quantity, siteNames);
      } catch (sheetErr) {
        console.error("Sheet update failed:", sheetErr.message);
      }

    } catch (txnErr) {
      console.error("Transaction logging failed:", txnErr.message);
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error increasing quantity", error: err.message });
  }
};
export const IncreaseQuantityByOne = async (req, res) => {
  const { itemId, userId } = req.body;

  if (!itemId || !userId) {
    return res.status(400).json({ message: "Item ID and user ID are required" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    item.quantity += 1;
    item.lastUpdated = new Date();
    const updatedItem = await item.save();

    // Respond to client
    res.status(200).json({
      message: "Quantity increased by one successfully",
      item: updatedItem
    });

    // Background transaction logging
    try {
      const [workSite, user] = await Promise.all([
        WorkSite.findById(updatedItem.workSiteId).lean(),
        User.findById(userId).lean(),
      ]);

      const workSiteName = workSite?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        itemId: updatedItem._id.toString(),
        itemName: updatedItem.itemName,
        userId: userId,
        quantity: 1,
        toSite: updatedItem.workSiteId,
        description: `1 unit added to "${updatedItem.itemName}" at "${workSiteName}" by "${userName}"`,
      });

      await transaction.save();

      try {
        const siteNames = await WorkSite.find().lean().then(sites => sites.map(s => s.workSiteName).slice(1));
        await appendInventoryUpdateRow(updatedItem.itemName, updatedItem.quantity, siteNames);
      } catch (sheetErr) {
        console.error("Sheet update failed:", sheetErr.message);
      }

    } catch (txnErr) {
      console.error("Transaction logging failed:", txnErr.message);
    }

  } catch (err) {
    console.error("Error increasing quantity by one:", err.message);
    res.status(500).json({ message: "Error increasing quantity by one", error: err.message });
  }
};
export const DecreaseQuantity = async (req, res) => {
  const { itemId, quantity, userId } = req.body;

  if (!itemId || !quantity || !userId) {
    return res.status(400).json({ message: "Item ID, quantity, and user ID are required" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.quantity - quantity < 0) {
      return res.status(400).json({ message: "Quantity cannot be less than 0" });
    }

    item.quantity -= quantity;
    item.lastUpdated = new Date();
    const updatedItem = await item.save();

    // Send response to client
    res.status(200).json({
      message: "Quantity decreased successfully",
      item: updatedItem
    });

    // Transaction logging in background
    try {
      const [workSite, user] = await Promise.all([
        WorkSite.findById(updatedItem.workSiteId).lean(),
        User.findById(userId).lean(),
      ]);

      const workSiteName = workSite?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        itemId: updatedItem._id.toString(),
        itemName: updatedItem.itemName,
        userId: userId,
        quantity: quantity,
        fromSite: updatedItem.workSiteId,
        description: `"${quantity}" units removed from "${updatedItem.itemName}" at "${workSiteName}" by "${userName}"`,
      });

      await transaction.save();

      try {
        const siteNames = await WorkSite.find().lean().then(sites => sites.map(s => s.workSiteName).slice(1));
        await appendInventoryUpdateRow(updatedItem.itemName, updatedItem.quantity, siteNames);
      } catch (sheetErr) {
        console.error("Sheet update failed:", sheetErr.message);
      }

    } catch (txnErr) {
      console.error("Transaction logging failed:", txnErr.message);
    }

  } catch (err) {
    console.error("Error decreasing quantity:", err.message);
    res.status(500).json({ message: "Error decreasing quantity", error: err.message });
  }
};
export const DecreaseQuantityByOne = async (req, res) => {
  const { itemId, userId } = req.body;

  if (!itemId || !userId) {
    return res.status(400).json({ message: "Item ID and user ID are required" });
  }

  try {
    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (item.quantity - 1 < 0) {
      return res.status(400).json({ message: "Quantity cannot be less than 0" });
    }

    item.quantity -= 1;
    item.lastUpdated = new Date();
    const updatedItem = await item.save();

    // Send response first
    res.status(200).json({
      message: "Quantity decreased by one successfully",
      item: updatedItem
    });

    // Log transaction in background
    try {
      const [workSite, user] = await Promise.all([
        WorkSite.findById(updatedItem.workSiteId).lean(),
        User.findById(userId).lean(),
      ]);

      const workSiteName = workSite?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        itemId: updatedItem._id.toString(),
        itemName: updatedItem.itemName,
        userId: userId,
        fromSite: updatedItem.workSiteId,
        description: `1 unit removed from "${updatedItem.itemName}" at "${workSiteName}" by "${userName}"`,
      });

      await transaction.save();

      try {
        const siteNames = await WorkSite.find().lean().then(sites => sites.map(s => s.workSiteName).slice(1));
        await appendInventoryUpdateRow(updatedItem.itemName, updatedItem.quantity, siteNames);
      } catch (sheetErr) {
        console.error("Sheet update failed:", sheetErr.message);
      }

    } catch (txnErr) {
      console.error("Transaction logging failed:", txnErr.message);
    }

  } catch (err) {
    console.error("Error decreasing quantity by one:", err.message);
    res.status(500).json({ message: "Error decreasing quantity by one", error: err.message });
  }
};
export const GetItemsPagination = async (req, res) => {

  let { page = 1, limit = 10, worksiteId, search = "", name } = req.query;

  page = parseInt(page);
  limit = parseInt(limit);
  const skip = (page - 1) * limit;

  try {
    const query = {};

    // Filter by worksiteId if valid
    if (worksiteId && worksiteId.trim() && worksiteId !== "null" && worksiteId !== "undefined") {
      query.workSiteId = worksiteId;
    }

    // Filter by search or exact name
    if (name && name.trim()) {
      // Exact match on name
      query.itemName = name.trim();
    } else if (search && search.trim()) {
      // Fallback to regex search
      query.itemName = { $regex: search.trim(), $options: "i" };
    }

    const items = await Item.find(query).skip(skip).limit(limit);
    const totalItems = await Item.countDocuments(query);

    res.status(200).json({
      items,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching items with pagination:", error);
    res.status(500).json({ message: "Error fetching items", error: error.message });
  }
};

export const SendItem = async (req, res) => { 
    try {
    const { itemId, from, to, quantity, userId } = req.body;
    if (!itemId || !from || !to || !quantity || !userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (from === to) {
      return res.status(400).json({ message: "Source and destination cannot be the same" });
    }
    const sourceItem = await Item.findOne({ _id: itemId, workSiteId: from });
      
    if (!sourceItem || sourceItem.quantity < quantity) {
      return res.status(400).json({ message: "Insufficient quantity at source" });
    }
    sourceItem.quantity -= quantity;
    await sourceItem.save();

    let destItem = await Item.findOne({ itemName: sourceItem.itemName, workSiteId: to, fromSite: from });
    if (destItem) {
      // Increase quantity if it exists
      destItem.quantity += quantity;
      await destItem.save();
    } else {
      const destinationWorkSite = await WorkSite.findById(to);
      if (!destinationWorkSite) {
        return res.status(404).json({ message: "Destination worksite not found" });
      }

      destItem = new Item({
        itemName: sourceItem.itemName,
        image: sourceItem.image,
        pricePerItem: sourceItem.pricePerItem,
        itemCategory: sourceItem.itemCategory,
        itemSubCategory: sourceItem.itemSubCategory,
        quantity: quantity,
        fromSite:from,
        workSiteId: to,
        workSite:destinationWorkSite.workSiteName, 
        lastUpdated: new Date(),
      });
      await destItem.save();
      }
        
      res.status(200).json({
        message: "Item transferred successfully",
        from: sourceItem,
        to: destItem,
      });

      try {
      const [fromSite, toSiteObj, user] = await Promise.all([
        WorkSite.findById(from).lean(),
        WorkSite.findById(to).lean(),
        User.findById(userId).lean(),
      ]);

      const fromSiteName = fromSite?.workSiteName || "Unknown Site";
      const toSiteName = toSiteObj?.workSiteName || "Unknown Site";
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        itemId: sourceItem._id.toString(),
        itemName: sourceItem.itemName,
        userId: userId,
        quantity: quantity,
        fromSite: from,
        toSite: to,
        description: `${quantity} units of "${sourceItem.itemName}" transferred from ${fromSiteName} to ${toSiteName} by ${userName}`,
      });

        await transaction.save();
        
        try {
          const siteNames = await WorkSite.find().lean().then(sites => sites.map(site => site.workSiteName).slice(1));
        
          const fromSiteName = fromSite?.workSiteName || 'Store Room';
          const toSiteName = toSiteObj?.workSiteName || 'Store Room';
        
          await recordItemTransferInSheet(
            sourceItem.itemName,
            siteNames,
            fromSiteName,
            toSiteName,
            quantity
          );
        } catch (sheetErr) {
          console.error("Sheet update for transfer failed:", sheetErr.message);
        }

    } catch (txnErr) {
      console.error("Transaction logging failed:", txnErr.message);
    }   
    } catch (error) {
        console.error("Error sending item:", error);
        res.status(500).json({ message: "Error sending item", error: error.message });
        
    }
}

export const SendItemToStoreRoom = async (req, res) => { 
  try {
  const { itemId, from, to, quantity, userId } = req.body;
  if (!itemId || !from || !to || !quantity || !userId) {
    return res.status(400).json({ message: "Missing required fields" });
  }
  if (from === to) {
    return res.status(400).json({ message: "Source and destination cannot be the same" });
  }
  const sourceItem = await Item.findOne({ _id: itemId, workSiteId: from });
    
  if (!sourceItem || sourceItem.quantity < quantity) {
    return res.status(400).json({ message: "Insufficient quantity at source" });
  }
  sourceItem.quantity -= quantity;
  await sourceItem.save();

  let destItem = await Item.findOne({ itemName: sourceItem.itemName, workSiteId: to });
  if (destItem) {
    // Increase quantity if it exists
    destItem.quantity += quantity;
    await destItem.save();
  } else {
    const destinationWorkSite = await WorkSite.findById(to);
    if (!destinationWorkSite) {
      return res.status(404).json({ message: "Destination worksite not found" });
    }

    destItem = new Item({
      itemName: sourceItem.itemName,
      image: sourceItem.image,
      pricePerItem: sourceItem.pricePerItem,
      itemCategory: sourceItem.itemCategory,
      itemSubCategory: sourceItem.itemSubCategory,
      quantity: quantity,
      fromSite:from,
      workSiteId: to,
      workSite:destinationWorkSite.workSiteName, 
      lastUpdated: new Date(),
    });
    await destItem.save();
    }
      
    res.status(200).json({
      message: "Item transferred successfully",
      from: sourceItem,
      to: destItem,
    });

    try {
    const [fromSite, toSiteObj, user] = await Promise.all([
      WorkSite.findById(from).lean(),
      WorkSite.findById(to).lean(),
      User.findById(userId).lean(),
    ]);

    const fromSiteName = fromSite?.workSiteName || "Unknown Site";
    const toSiteName = toSiteObj?.workSiteName || "Unknown Site";
    const userName = user?.name || "Unknown User";

    const transaction = new Transaction({
      itemId: sourceItem._id.toString(),
      itemName: sourceItem.itemName,
      userId: userId,
      quantity: quantity,
      fromSite: from,
      toSite: to,
      description: `${quantity} units of "${sourceItem.itemName}" transferred from ${fromSiteName} to ${toSiteName} by ${userName}`,
    });

      await transaction.save();
      
      try {
        const siteNames = await WorkSite.find().lean().then(sites => sites.map(site => site.workSiteName).slice(1));
      
        const fromSiteName = fromSite?.workSiteName || 'Store Room';
        const toSiteName = toSiteObj?.workSiteName || 'Store Room';
      
        await recordItemTransferInSheet(
          sourceItem.itemName,
          siteNames,
          fromSiteName,
          toSiteName,
          quantity
        );
      } catch (sheetErr) {
        console.error("Sheet update for transfer failed:", sheetErr.message);
      }

  } catch (txnErr) {
    console.error("Transaction logging failed:", txnErr.message);
  }   
  } catch (error) {
      console.error("Error sending item:", error);
      res.status(500).json({ message: "Error sending item", error: error.message });
      
  }
}

export const getItemsFromSiteAndWorkSite = async (req, res) => {
  const { fromSite, worksiteId } = req.body;
  const { search = "", page = 1, limit = 10 } = req.query;

  try {
    const searchRegex = new RegExp(search, "i");

    const query = {
      workSiteId: new mongoose.Types.ObjectId(worksiteId),
      itemName: { $regex: searchRegex },
    };

    // Only add fromSite to the query if it's not null or undefined
    if (fromSite) {
      query.fromSite = new mongoose.Types.ObjectId(fromSite);
    }

    const totalItems = await Item.countDocuments(query);

    const items = await Item.find(query)
      .populate("fromSite")
      .populate("workSiteId")
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));

    res.status(200).json({
      items,
      totalItems,
      currentPage: Number(page),
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (error) {
    console.error("Error fetching items from site and worksite:", error);
    res.status(500).json({ message: "Server error" });
  }
};

