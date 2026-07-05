import { Router } from "express";
import { adminRouter } from "./admin";
import { userRouter } from "./user";
import { spaceRotuer } from "./space";

export const router = Router()

router.get("/signup", (req, res) => {
  res.json({
    message: "Signup"
  })
})


router.get("/signin", (req, res) => {
  res.json({
    message: "Signin"
  })
})

router.get("/elements", (req, res) => {

})


router.get("/avatars", (req, res) => {

})


router.use("/user", userRouter)
router.use("/admin", adminRouter)
router.use("/space", spaceRotuer)
