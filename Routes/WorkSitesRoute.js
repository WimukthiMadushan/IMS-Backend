import express from "express";
import {GetAllSites, AddSite,DeleteWorkStation,UpdateWorkStation,getSitesCount,GetSiteById} from "./../Controller/WorkSitesController.js";
const router = express.Router();

router.get("/getSites", GetAllSites)
router.get("/getSitesCount", getSitesCount)
router.get("/getSite/:id", GetSiteById)
router.post("/addSite", AddSite)
router.delete("/deleteSite/:id", DeleteWorkStation)
router.put("/updateSite/:id", UpdateWorkStation)

export default router;