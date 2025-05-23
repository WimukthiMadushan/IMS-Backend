import express from "express";
import {
    AddItem,
    GetItems,
    GetItemsBySiteId,
    EditItem,
    DeleteItem,
    IncreaseQuantity,
    IncreaseQuantityByOne,
    DecreaseQuantity,
    DecreaseQuantityByOne,
    SendItem,
    GetItemsByName,
    GetItemsPagination,
    GetItemsQuantity,
    GetUniqueItemCount,
    getItemsFromSiteAndWorkSite,
    getItemsInTheTrash,
    getItemsIntheRepair,
    GetAllItems,
    SendItemToStoreRoom
} from "./../Controller/ItemController.js";
const router = express.Router();

router.get("/getItems", GetItems)
router.get("/getAllItems", GetAllItems)
router.post("/addItem", AddItem);
router.get("/getItems/:id", GetItemsBySiteId);
router.get("/getItemsByName", GetItemsByName);
router.get("/getItemsPagination", GetItemsPagination)
router.get("/getItemsQuantity", GetItemsQuantity)
router.get("/getItemsInTrash/:id", getItemsInTheTrash);
router.get("/getItemsInRepair/:id", getItemsIntheRepair);
router.get("/getUniqueItemCount", GetUniqueItemCount)
router.put("/updateItem/:id", EditItem);
router.delete("/deleteItem/:id", DeleteItem);
router.put("/increaseQuantity", IncreaseQuantity)
router.put("/increaseQuantityByOne", IncreaseQuantityByOne)
router.put("/decreaseQuantity", DecreaseQuantity)
router.put("/decreaseQuantityByOne", DecreaseQuantityByOne)
router.post("/sendItem", SendItem)
router.post("/sendItemToStoreRoom", SendItemToStoreRoom)
router.post("/getItemsFromSiteAndWorkSite", getItemsFromSiteAndWorkSite)

export default router;