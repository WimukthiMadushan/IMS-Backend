import User from "./../Models/UserModel.js"
import WorkSite from "./../Models/WorkSitesModel.js"
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const signup = async (req, res) => { 
    const { name, email, password,role } = req.body;
    if (!email || !password || !name) {
        return res
            .status(400)
            .send("All fields email, password and name are required");
    }
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send("User already exists");
        }
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            email,
            name,
            password: hashedPassword,
            status: role || "manager",
        });
        await newUser.save();

        res.status(201).json({
            message: "User registered successfully.",
            user: {
              _id: newUser._id,
              name: newUser.name,
              email: newUser.email,
              status: newUser.status,
            },
          });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
const signin = async (req, res) => { 
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).send("All fields email and password are required");
    }
    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).send("User not found");
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).send("Invalid password");
        }
        console.log(user.status);
        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                name: user.name,
                status: user.status,
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRATION }
        );
        res.status(200).json({
            message: "Login successful",
            token,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
const getAllUsersByPagination = async (req, res) => {
  const { page = 1, limit = 10, search = "" } = req.query;

  const query = {
    $or: [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ]
  };
  try {
    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const count = await User.countDocuments(query);

    res.status(200).json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
const getAllManagers = async (req, res) => {
    try {
        const managers = await User.find({ status: "manager" });
        res.status(200).json(managers);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
const getManagersCount = async (req, res) => {
    try {
        const count = await User.countDocuments({ status: "manager" });
        res.status(200).json({ count });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
const getAdminsCount = async (req, res) => {
    try {
        const count = await User.countDocuments({ status: "admin" });
        res.status(200).json({ count });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
const getAllAdmins = async (req, res) => {
    try {
        const admins = await User.find({ status: "admin" });
        res.status(200).json(admins);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const isManager = await WorkSite.findOne({ workSiteManager: id });
        if (isManager) {
            return res.status(400).json({
              message: "Cannot delete user. They are assigned as a manager of a work site.",
            });
        }
        
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}
const getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.status(200).json(users);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Internal server error" });
    }
}


export { signup, signin, getAllUsersByPagination ,getAllManagers, getAllAdmins,deleteUser, getManagersCount,getAdminsCount,getAllUsers };