import WorkSite from "./../Models/WorkSitesModel.js";
import Transaction from "../Models/TransactionModel.js";
import User from "../Models/UserModel.js";
import Item from "./../Models/Item.js";
import { addSiteToAllItemSheets } from "./../Services/googleSheetService.js"; 

export const GetAllSites = (req, res) => {
    const searchQuery = req.query.search;
    let filter = {};
    if (searchQuery) {
        filter = {
            workSiteName: { $regex: searchQuery, $options: "i" },
        };
    }
    WorkSite.find(filter)
        .then(sites => {
            res.status(200).json(sites);
        })
        .catch(err => {
            res.status(500).json({ message: "Error fetching work sites", error: err });
        });
}
export const GetSiteById = async (req, res) => {
  const { id } = req.params;

  try {
    const site = await WorkSite.findById(id).populate("workSiteManager", "name");

    if (!site) {
      return res.status(404).json({ message: "Work site not found" });
    }

    res.status(200).json(site);
  } catch (err) {
    console.error("Error fetching work site:", err);
    res.status(500).json({ message: "Error fetching work site", error: err.message });
  }
};
export const getSitesCount = async (req, res) => {
    try {
        const count = await WorkSite.countDocuments();
        res.status(200).json({ count });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
export const AddSite = async (req, res) => {
  try {
    console.log('Request body:', req.body);

    const newWorkSite = new WorkSite({
      workSiteName: req.body.workSiteName,
      address: req.body.address,
      workSiteManager: req.body.workSiteManager,
    });
    const savedSite = await newWorkSite.save();
    res.status(201).json(savedSite);

    try {
      const [user] = await Promise.all([
        User.findById(req.body.userId).lean(),
      ]);

      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        userId: req.body.userId,
        description: `Work site "${savedSite.workSiteName}" created by ${userName}`,
      });

      await transaction.save();

      try {
        await addSiteToAllItemSheets(savedSite.workSiteName);
      } catch (sheetErr) {
        console.error("Sheet update failed for new site:", sheetErr.message);
      }

    } catch (txnErr) {
      console.error("Transaction save failed:", txnErr.message);
      res.status(500).json({ message: "Error saving transaction", error: txnErr.message });
    }
  } catch (error) {
    console.error("Error adding work site:", error);
    res.status(500).json({ message: "Error adding work site", error: error.message });
  }
};
export const DeleteWorkStation = async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;

  try {
    // Step 1: Delete the worksite
    const deletedSite = await WorkSite.findByIdAndDelete(id);

    if (!deletedSite) {
      return res.status(404).json({ message: "Work site not found" });
    }

    // Step 2: Respond to client
    res.status(200).json({ message: "Work site deleted successfully" });

    // Step 3: Clean up related items (non-blocking)
    Item.deleteMany({ workSiteId: id }).catch(() => {});

    // Step 4: Log transaction (non-blocking)
    try {
      const user = await User.findById(userId).lean();
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        userId,
        description: `Work site "${deletedSite.workSiteName}" deleted by ${userName}`,
      });

      await transaction.save();
    } catch (txnErr) {
      console.error("Transaction save failed:", txnErr.message);
    }

  } catch (err) {
    return res.status(500).json({ message: "Error deleting work site", error: err.message });
  }
};
export const UpdateWorkStation = async (req, res) => {
  const { id } = req.params;
  const { workSiteName, address, workSiteManager, userId } = req.body;

  try {
    const updatedSite = await WorkSite.findByIdAndUpdate(
      id,
      { workSiteName, address, workSiteManager },
      { new: true, runValidators: true }
    );

    if (!updatedSite) {
      return res.status(404).json({ message: "Work site not found" });
    }

    // Respond to client
    res.status(200).json(updatedSite);

    // Log transaction
    try {
      const user = await User.findById(userId).lean();
      const userName = user?.name || "Unknown User";

      const transaction = new Transaction({
        userId,
        description: `Work site "${updatedSite.workSiteName}" updated by ${userName}`,
      });

      await transaction.save();
    } catch (txnErr) {
      console.error("Transaction save failed:", txnErr.message);
    }
  } catch (err) {
    res.status(500).json({ message: "Error updating work site", error: err.message });
  }
};


