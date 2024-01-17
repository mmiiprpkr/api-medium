import express from 'express';
import mongoose from 'mongoose';
import dotenv, { config } from 'dotenv';
import bcrypt from 'bcrypt';
import User from './Schema/User.js';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import admin from 'firebase-admin'
import {getAuth} from "firebase-admin/auth";
import blogRouter from './routes/blog.js'

dotenv.config()

const serviceAccountKey1 =  {
    "type": process.env.type,
    "project_id": process.env.project_id,
    "private_key_id": process.env.private_key_id,
    "private_key": process.env.private_key.replace(/\\n/g, '\n'),
    "client_email": process.env.client_email,
    "client_id": process.env.client_id,
    "auth_uri": process.env.auth_uri,
    "token_uri": process.env.token_uri,
    "auth_provider_x509_cert_url": process.env.auth_provider_x509_cert_url,
    "client_x509_cert_url": process.env.client_x509_cert_url,
    "universe_domain": process.env.universe_domain
}

const server = express();

server.use(express.json());
const corsOptions = {
    origin: '*', 
    credentials: true,
  };
server.use(cors(corsOptions));


admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey1)
})

let emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/; // regex for email
let passwordRegex = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,20}$/; // regex for password

mongoose.connect(process.env.DB_LOCATION , {
    autoIndex: true,
})
.then(() => console.log('connect success to mongodb'))
.catch(() => console.log('connect fail'));

//todo : fuction format data ที่ได้จากการ fetch ข้อมูลใน mongodb;
const formatDatatoSend = (user) => {

    const access_token = jwt.sign({id : user._id } , process.env.SECRET_ACCESS_KEY )

    return {
        access_token,
        profile_img : user.personal_info.profile_img,
        username : user.personal_info.username,
        fullname : user.personal_info.fullname
    }
}

//todo : routes สำหรับ api blog.js
server.use(blogRouter);

//todo : test api
server.post('/' , (req,res) => {
    res.send("this api is running...");
})

//todo : api สำหรับ signup
server.post('/signup' , async (req,res) => {
    try {
        const {fullname , email , password } = req.body;

        if(fullname?.length < 3){
            return res.status(403).json({"msg" : "Fullname must be a least 3"})
        }

        if(!email?.length){
            return res.status(403).json({"msg" : "Enter email address"})
        }

        if(!emailRegex.test(email)){
            return res.status(403).json({ "msg" : "Email invalid"})
        }

        if(!passwordRegex.test(password)){
            return res.status(403).json({"msg" : "Password should be 6 to 20 charactor long with a numberic , 1 lowercase and 1 uppercase"})  
        }

        const hash_password = await bcrypt.hash(password , 10)

        const username = email.split('@')[0];

        const user = new User({
            personal_info : {
                fullname,
                email,
                password : hash_password,
                username,
            }
        })

        const userDoc = await user.save();

        return res.status(200).json(formatDatatoSend(userDoc))

    } catch (error) {
        if(error.code === 11000){
            return res.status(404).json({"msg" : "Email Aleary Exits"})
        }
        return res.status(500).json({"msg" : error})
    }
})

server.post('/signin' ,async (req,res) => {
    try {
        const {email , password } = req.body;

        const findEmail = await User.findOne({"personal_info.email" : email})

        if(!findEmail) {
            return res.status(403).json({ msg: "Email not found" });
        }

        if(findEmail.google_auth){
            return res.status(403).json({ msg: "This Email Authentication wiht Google , Pls Continue with google" });
        }

        const correctPassword = await bcrypt.compare(password,findEmail.personal_info.password);

        if(!correctPassword){
            return res.status(403).json({ msg: "Incorrect password" });
        }

        return res.status(200).json(formatDatatoSend(findEmail))

    } catch (error) {
        return res.status(500).json({"msg" : error});
    }
})

//todo : login ด้วย google
server.post('/google-auth' , async (req, res) => {
    let {access_token } = req.body;
    try {
        const UserfromGoogleAuth = await getAuth().verifyIdToken(access_token);
        const findEmail = await User.findOne({"personal_info.email" : UserfromGoogleAuth.email})
        if(findEmail){
            if(!findEmail.google_auth){
                return res.status(403).json({"msg" : "This email was signed up with password , Please log in with password to access the account"})
            }
            return res.status(200).json(formatDatatoSend(findEmail))
        }

        const { email , name , picture  } = UserfromGoogleAuth;
        const username = email.split('@')[0];
        const newUser = new User({
            personal_info:{
                fullname : name , 
                email : email , 
                // profile_img : picture ,
                username } , 
            google_auth:true
        })

        const UserDoc = await newUser.save();
        return res.status(200).json(formatDatatoSend(UserDoc));

    } catch (error) {
        return res.json(error)
    }
})

server.listen(3000 , () => {
    console.log('server is running on port 3000');
})