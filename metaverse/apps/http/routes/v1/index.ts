import { Router } from "express";

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
router.use("/space", spaceRouter)
