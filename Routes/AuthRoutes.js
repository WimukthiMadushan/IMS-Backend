import express from 'express';
const router = express.Router();
import { signup, signin, getAllUsersByPagination,getAllManagers,getAllAdmins, deleteUser,getManagersCount,getAdminsCount,getAllUsers } from './../Controller/AuthController.js';

router.post("/signup", signup);
router.post("/signin", signin);
router.get("/getusersbypagination", getAllUsersByPagination)
router.get("/getmanagers", getAllManagers);
router.get("/getmanagersCount", getManagersCount);
router.get("/getadmins", getAllAdmins);
router.get("/getadminsCount", getAdminsCount);
router.delete("/deleteuser/:id", deleteUser);
router.get("/getallusers", getAllUsers);

export default router;