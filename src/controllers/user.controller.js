import JWT from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    return res
      .send(500)
      .json({ error: "something went wrong while generating tokens" });
  }
};

const registerUser = async (req, res) => {
  // get user details from frontend
  // validation - not empty
  // check if user already exists : username, email
  // check for images, check for avatar
  // upload them to cloudinary, avatar
  // create user object - create entry in db
  // remove password and refresh token fields from response
  // check for user creation
  // return res

  const { username, email, fullName, password } = req.body;
  if (!username || !email || !fullName || !password) {
    // throw new Error("All fields are required");
    return res.status(400).json({ error: "All fields are required" });
  }

  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    return res
      .status(409)
      .json({ error: "User with email or username already exists" });
  }

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) {
    return res.status(400).json({ error: "Avatar file is required" });
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    return res.status(400).json({ error: "Avatar file is required" });
  }

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken -watchHistory"
  );
  if (!createdUser) {
    return res
      .status(500)
      .json({ error: "Something went wrong while registering the user" });
  }

  return res.status(201).json({ createdUser });
};

const loginUser = async (req, res) => {
  // req body -> data
  // validate username or email
  // find the user
  // password check
  // access and refresh token
  // send cookie

  const { email, username, password } = req.body;
  if (!email && !username) {
    return res.status(400).json({ error: "Username or Email is required" });
  }

  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    return res.status(401).json({ error: "Invalid login credentials" });
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json({
      user: loggedInUser,
      accessToken,
      refreshToken,
      message: "User logged in Successfully",
    });
};

const logoutUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json({ message: "User logged out successfully" });
};

const refreshAccessToken = async (req, res) => {
  try {
    const incomingRefreshToken =
      req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
      return res.status(401).json({ error: "Unauthorized Request" });
    }

    const decodedToken = JWT.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      return res.status(401).json({ error: "Invalid Refresh Token" });
    }

    if (incomingRefreshToken != user?.refreshToken) {
      return res
        .status(401)
        .json({ error: "Refresh Token is expired or used" });
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json({
        accessToken,
        refreshToken: newRefreshToken,
        message: "Action Token Refreshed",
      });
  } catch (error) {
    return res.status(401).json({ error: "Invalid Refresh Token" });
  }
};

const changeCurrentPassword = async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const user = await User.findById(req.user?._id);
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordValid) {
    return res.status(400).json({ error: "Invalid Old Password" });
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res.status(200).json({ message: "Password Changed Successfully" });
};

const getCurrentUser = async (req, res) => {
  return res
    .status(200)
    .json({ data: req.user, message: "User fetched successfully" });
};

const updateAccountDetails = async (req, res) => {
  const { fullName, email } = req.body;
  if (!fullName || !email) {
    return res.status(400).json({ error: " all fields are required" });
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json({ data: user, message: "Account details updated successfully" });
};

const updateUserAvatar = async (req, res) => {
  const avatarlocalPath = req.file?.path;
  if (!avatarlocalPath) {
    return res.status(400).json({ error: "Avatar file is missing" });
  }

  const avatar = await uploadOnCloudinary(avatarlocalPath);
  if (!avatar.url) {
    return res.status(400).json({ error: "Error while updating avatar " });
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar?.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json({ data: user, message: "Avatar updated Successfully" });
};

const updateUserCoverImage = async (req, res) => {
  const coverImagelocalPath = req.file?.path;
  if (!coverImagelocalPath) {
    return res.status(400).json({ error: "Cover Image file is missing" });
  }

  const coverImage = await uploadOnCloudinary(coverImagelocalPath);
  if (!coverImage.url) {
    return res.status(400).json({ error: "Error while updating Cover Image" });
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage?.url,
      },
    },
    { new: true }
  ).select("-password");

  return res
    .status(200)
    .json({ data: user, message: "Cover Image Updated Successfully" });
};

const getUserChannelProfile = async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    return res.status(404).json({ error: "username is missing" });
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);

  console.log("my channel", channel);

  if (!channel?.length) {
    return res.status(404).json({ error: "channel doesn't exist" });
  }

  return res
    .status(200)
    .json({ data: channel[0], message: "user channel fetched successfully" });
};


export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
  getUserChannelProfile,
};
