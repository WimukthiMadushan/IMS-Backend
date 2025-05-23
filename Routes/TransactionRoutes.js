import express from "express";
import { AddTranaction, GetAllTransaction,GetAllTransactionsByFilter,GetTransactionByWorkSiteId} from "./../Controller/TransactionController.js";
const router = express.Router();

router.post("/addTransaction", AddTranaction);
router.get("/getAllTransaction", GetAllTransaction);
router.post("/getTransactionByWorkSiteId", GetTransactionByWorkSiteId);
router.post("/getTransactionsByFilter", GetAllTransactionsByFilter);



export default router;