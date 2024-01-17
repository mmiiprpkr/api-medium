import express from 'express';
import jwt from 'jsonwebtoken';
import Blog from '../Schema/Blog.js';
import User from '../Schema/User.js';
const router = express.Router();
//todo : middleware check ว่าทำการ auth รึยัง
const verifyJWT = (req , res , next) => {
    //todo : authorization ส่งมาจาก headers
    const authHeader = req.headers['authorization'];
    //todo : ทำการ split แล้วเอาเฉพาะ token ข้างหลัง
    const token = authHeader.split(" ")[1];

    if(token === null){
        return res.status(401).json({ error : "No access token"})
    }

    jwt.verify(token , process.env.SECRET_ACCESS_KEY , (err , user) => {
        if(err){
            return res.status(403).json({error : "access token is invalid"})
        }
        req.user = user.id
        next();
    })
}

router.post('/search-users' , (req,res) => {
    let {query} = req.body;
    User.find({"personal_info.username" : new RegExp(query , 'i')})
    .limit(50)
    .select("personal_info.fullname personal_info.username personal_info.profile_img -_id")
    .then(user => {
        return res.status(200).json(user)
    })
    .catch(err => {
        console.log(err);
        return res.status(500).json({error : err.message})
    })
})

router.post('/create-blog', verifyJWT , async(req,res) => {
    try {
        let authorId = req.user;
        let {title , des , banner , tags , content , draft } = req.body;
        if(!title.length){
            return res.status(403).json({error : "You must provide a title to publish the blog"})
        }

        if(!draft){
            if(!banner.length){
                return res.status(403).json({error : "You must provide blog banner to publish it"})
            }
            if(!content.blocks.length){
                return res.status(403).json({error : "There must be some blog content to publish it"})
            }
            if(!tags.length || tags.length > 10){
                return res.status(403).json({error : "Provide tags in order to publish the blog , Maximum 10"})
            }
            if(!des.length){
                return res.status(403).json({error : "You must provide blog description under 200 characters"})
            }
        }
        tags = tags.map(tag => tag.toLowerCase());
        let blog_id = title.replace(/[^a-zA-Z0-9]/g , ' ').replace(/\s+/g, "-").trim() + new Date().getTime().toString();
        let blog = new Blog({
            title, des,banner , content , tags , author : authorId , blog_id , draft:Boolean(draft)
        })

        blog.save().then(blog => {
            let incrementVal = draft ? 0 : 1;
            User.findOneAndUpdate({_id : authorId} , {$inc : {"account_info.total_posts" : incrementVal }, $push : {
                "blogs" : blog._id
            }}).then(user => {
                return res.status(200).json({ id:blog.blog_id})
            }).catch(err => {
                return res.status(500).json({error : "Fail to update total posts number"})
            })
        }).catch(err => {
            return res.status(500).json({error : err.message})
        })
        console.log(blog_id);
    } catch (error) {
        return res.status(500).json({error : error , "fromme" : "gogo"})
    }
})

router.post('/lastest-blog' , async(req , res) => {
    try {
        let { page } = req.body;
        let maxLimit = 5
        const blogLastest = await Blog.find({draft : false })
        .populate("author","personal_info.profile_img personal_info.username personal_info.fullname -_id")
        // .sort({"publisheAt" : -1})
        .select("blog_id title des banner activity tags publishedAt -_id")
        .skip((page - 1 ) * maxLimit)
        .limit(maxLimit)
        return res.status(200).json(blogLastest)
    } catch (error) {
        console.log(error)
    }
})

router.post('/all-lastest-blogs-count' , async (req,res) => {
    try {
        const BlogCount = await Blog.countDocuments({draft:false})
        return res.status(200).json({totalDocs : BlogCount})
    } catch (error) {
        console.log(error)
        return res.status(500).json({error : error.message});
    }
})


router.post('/search-blogs-count' , async (req,res ) => {
    try {
        let { tag , query} = req.body;
        let findQuery
        if(tag){
            findQuery = {tags : tag , draft: false };
        }else if(query){
            findQuery = {draft : false , title : new RegExp(query , 'i')}
        }
        const BlogCount = await Blog.countDocuments(findQuery)
        return res.status(200).json({totalDocs : BlogCount})
    } catch (error) {
        console.log(error)
        return res.status(500).json({error : error.message});
    }
})

router.get('/trending-blog' , async(req , res ) => {
    try {

        const trendingBlog = await Blog.find({draft: false })
        .populate("author","personal_info.profile_img personal_info.username personal_info.fullname -_id")
        .sort({"activity.total_read" : -1 , "activity.total_likes" : -1, "publishedAt" : -1 })
        .select("blog_id title publishedAt -_id")
        .limit(5);
    
        return res.status(200).json(trendingBlog)
    } catch (error) {
        console.log(error);
        return res.status(403).json({error: "Fail to fetch trending-blog"})
    }

})

router.post('/search-blogs', async (req , res ) => {
    try {
        let { tag  , query , page} = req.body;
        let findQuery
        if(tag){
            findQuery = {tags : tag , draft: false };
        }else if(query){
            findQuery = {draft : false , title : new RegExp(query , 'i')}
        }

        let MaxLimit = 5;
        const searchBlogs = await Blog.find(findQuery)
        .populate("author","personal_info.profile_img personal_info.username personal_info.fullname -_id")
        .sort({"publisheAt" : -1}).select("blog_id title des banner activity tags publishedAt -_id")
        .skip((page - 1 ) * MaxLimit)
        .limit(MaxLimit)

        return res.status(200).json(searchBlogs)

    } catch (error) {
        console.log(error)
        return res.status(403).json({error: "Fail to fetch searching-blog"})
    }
})

export default router;