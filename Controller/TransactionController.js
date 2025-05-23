import Transaction from "./../Models/TransactionModel.js";

export const AddTranaction = async (req, res) => {
    try {
        const { transactionId, itemId, userId, quantity, fromSite, toSite, description } = req.body;
        const newTransaction = new Transaction({
            transactionId,
            itemId,
            userId,
            quantity,
            fromSite,
            toSite,
            description
        });
        await newTransaction.save();
        res.status(201).json({ message: "Transaction added successfully", data: newTransaction });
    } catch (error) {
        res.status(500).json({ message: "Error adding transaction", error: error.message });
    }
};
export const GetAllTransaction = async (req, res) => {
    try {
        const transactions = await Transaction.find();
        res.status(200).json({ message: "Transactions retrieved successfully", data: transactions });
    } catch (error) {
        res.status(500).json({ message: "Error retrieving transactions", error: error.message });
    }
}
export const GetAllTransactionsByFilter = async (req, res) => {
  try {
    const { filter } = req.body;

    const query = {};

    // Optional filters
    if (filter.fromSite) {
      query.fromSite = filter.fromSite;
    }

    if (filter.toSite) {
      query.toSite = filter.toSite;
    }

    if (filter.user) {
      query.userId = filter.user;
    }

    if (filter.item) {
      query.itemName = filter.item;
    }

    if (filter.dateRange && filter.dateRange.length === 2) {
      const [start, end] = filter.dateRange;
      query.createdAt = {
        $gte: new Date(start),
        $lte: new Date(end),
      };
    }

    const transactions = await Transaction.find(query).sort({ createdAt: -1 });
    res.status(200).json({
      message: "Transactions retrieved successfully",
      data: transactions,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error retrieving transactions",
      error: error.message,
    });
  }
};
export const GetTransactionByWorkSiteId = async (req, res) => {
  try {
    const { workSiteId } = req.body;

    // 1. Fetch all transactions for that site
    const transactions = await Transaction.find({ toSite: workSiteId });

    // 2. Get unique userIds and siteIds from transactions
    const userIds = [...new Set(transactions.map(t => t.userId))];
    const siteIds = [...new Set(transactions.map(t => t.toSite))];

    // 3. Fetch users and sites
    const users = await User.find({ _id: { $in: userIds } });
    const sites = await WorkSite.find({ _id: { $in: siteIds } });

    const userMap = Object.fromEntries(users.map(user => [user._id.toString(), user.name]));
    const siteMap = Object.fromEntries(sites.map(site => [site._id.toString(), site.workSiteName]));

    // 4. Attach names to transactions
    const enhancedTransactions = transactions.map(t => ({
      ...t._doc,
      userName: userMap[t.userId] || "Unknown User",
      siteName: siteMap[t.toSite] || "Unknown Site"
    }));

    res.status(200).json({
      message: "Transactions retrieved successfully",
      data: enhancedTransactions
    });

  } catch (error) {
    res.status(500).json({
      message: "Error retrieving transactions",
      error: error.message
    });
  }
};

