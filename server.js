const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const mysql = require("mysql");
const multer = require("multer");
const path = require("path");
require("dotenv").config();
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const fs = require("fs");
const mega = require("mega");

const app = express();
const port = 3001;

const pool = mysql.createPool({
  connectionLimit: "99",
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// cors
const corsOptions = {
  origin: "https://ite-lms.com",
  methods: "GET,PUT,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

// middlewares
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.static("public/avatars"));

// verify Token Middleware
const verifyTokenMiddleware = (req, res, next) => {
  const token = req.cookies.accessToken;

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(401).json({ msg: "Invalid token" });
    }
    req.user = user;
    next();
  });
};

const client = mega({ email: 'your_email@example.com', password: 'your_password' });

// file upload middleware
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public/avatars");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "_" + file.originalname);
  },
});
const upload = multer({ storage: storage });

const codeVerifications = {};
const userInfo = {
  fname: "",
  middlename: "",
  lname: "",
  gender: "",
  email: "",
  pass: "",
  role: "",
};

// register
app.post("/register", (req, res) => {
  const { fname, middlename, lname, gender, email, pass, role, code } =
    req.body;

  userInfo.fname = fname;
  userInfo.middlename = middlename;
  userInfo.lname = lname;
  userInfo.gender = gender;
  userInfo.email = email;
  userInfo.pass = pass;
  userInfo.role = role;
  userInfo.code = code;

  const randomCode = Math.floor(100000 + Math.random() * 900000);

  codeVerifications[email] = randomCode;

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "mohalidinlidasan333@gmail.com",
      pass: "zifd xuoh dhco ypnv",
    },
  });

  const mailOptions = {
    from: "ite_learning_management_system",
    to: email,
    subject: "Verification Code",
    text: `Your verification code is: ${randomCode}`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log(error);
      res.status(500).send("Error sending verification code.");
    } else {
      console.log("Email sent: " + info.response);
      res.status(200).send("success");
    }
  });
});

app.post("/verify", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const code = Number(req.body.code);

    if (code === codeVerifications[userInfo.email]) {
      let avatar = "";

      if (userInfo.gender === "Male") {
        avatar = "male.png";
      } else {
        avatar = "female.png";
      }
      const sql =
        "INSERT INTO tb_user (fname, middlename, lname, gender, email, pass, role, avatar) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
      db.query(
        sql,
        [
          userInfo.fname,
          userInfo.middlename,
          userInfo.lname,
          userInfo.gender,
          userInfo.email,
          userInfo.pass,
          userInfo.role,
          avatar,
        ],
        (err, result) => {
          db.release();

          if (err) return res.json({ error: "insert error" });
          return res.json({ msg: "registered" });
        }
      );
    } else {
      db.release();
      return res.json({ msg: "invalid" });
    }
  });
});

const forgotCode = {};
const forgotInfo = {
  email: "",
  pass: "",
};

// reset password
app.put("/reset", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { email, pass } = req.body;

    const sql1 = "SELECT * FROM tb_user WHERE email = ?";
    db.query(sql1, [email], (err1, result1) => {
      if (err1) {
        db.release(); // Release connection in case of error
        return res.json({ msg: "select error" });
      }

      if (result1.length === 0) {
        db.release(); // Release connection if no matching email found
        return res.json({ msg: "no-email" });
      }

      forgotInfo.email = email;
      forgotInfo.pass = pass;

      const randomCode = Math.floor(100000 + Math.random() * 900000);

      forgotCode[email] = randomCode;

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "mohalidinlidasan333@gmail.com",
          pass: "zifd xuoh dhco ypnv",
        },
      });

      const mailOptions = {
        from: "ite_learning_management_system",
        to: email,
        subject: "Verification Code",
        text: `Your verification code is: ${randomCode}`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        // Always release connection after sending the email
        db.release();

        if (error) {
          console.log(error);
          return res.status(500).send("Error sending verification code.");
        } else {
          console.log("Email sent: " + info.response);
          return res.status(200).send("code-sent");
        }
      });
    });
  });
});

// verifyEmail
app.post("/verifyEmail", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const code = Number(req.body.code);

    if (code === forgotCode[forgotInfo.email]) {
      const sql = "UPDATE tb_user SET pass = ? WHERE email = ?";

      db.query(sql, [forgotInfo.pass, forgotInfo.email], (err, result) => {
        // Release the database connection after the query is executed
        db.release();

        if (err) return res.json({ error: "update error" });
        return res.json({ msg: "success" });
      });
    } else {
      // Release the database connection if the code is invalid
      db.release();
      return res.json({ msg: "invalid" });
    }
  });
});

// login
app.post("/login", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { email, pass } = req.body;
    const sql = "SELECT * FROM tb_user WHERE email = ? AND pass = ?";

    db.query(sql, [email, pass], (err, result) => {
      if (err) {
        db.release(); // Release the connection in case of an error
        return res.json({ error: "select error" });
      }

      if (result.length > 0) {
        const id = result[0].id;
        const fname = result[0].fname;
        const middlename = result[0].middlename;
        const lname = result[0].lname;
        const role = result[0].role;
        const secretKey = process.env.SECRET_KEY;

        const token = jwt.sign({ id, role }, secretKey, {
          expiresIn: "1d",
        });
        res.cookie("accessToken", token, {
          httpOnly: true,
          secure: true,
          sameSite: "None",
        });

        const sql1 =
          "INSERT INTO tb_user_log (fname, middlename, lname, role, action, time) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";

        db.query(
          sql1,
          [fname, middlename, lname, role, "In"],
          (err1, result1) => {
            if (err1) {
              db.release(); // Release the connection in case of an error
              return res.json({ msg: "insert error" });
            }
            // All operations completed successfully, release the connection
            db.release();
          }
        );
        return res.json({ msg: "success", role: role });
      } else {
        // No matching user found, release the connection
        db.release();
        return res.json({ msg: "Wrong username or password" });
      }
    });
  });
});

// user auth
app.get("/isAuth", (req, res) => {
  const token = req.cookies.accessToken;

  if (!token) {
    return res.json({ msg: "no token" });
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(401).json({ msg: "Invalid token" });
    }
    return res.json({ isAuth: true, role: user.role });
  });
});

// userName
app.get("/userName", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const sql = "SELECT fname, lname FROM tb_user WHERE id = ?";

    db.query(sql, [userId], (err, result) => {
      if (err) {
        db.release(); // Release the connection in case of an error
        return res.json({ error: "select error" });
      }

      // Send the response with the user information
      res.json(result);

      // Release the connection after sending the response
      db.release();
    });
  });
});

// logout
app.get("/logout", verifyTokenMiddleware, (req, res) => {
  const userId = req.user.id;

  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT * FROM tb_user WHERE id = ?";

    db.query(sql, [userId], (err, result) => {
      if (err) {
        db.release(); // Release the connection in case of an error
        return res.json({ error: "select error" });
      }

      if (result.length > 0) {
        const fname = result[0].fname;
        const middlename = result[0].middlename;
        const lname = result[0].lname;
        const role = result[0].role;

        const sql1 =
          "INSERT INTO tb_user_log (fname, middlename, lname, role, action, time) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";

        db.query(
          sql1,
          [fname, middlename, lname, role, "Out"],
          (err1, result1) => {
            // Release the connection after the query is executed
            db.release();

            if (err1) return res.json({ msg: "insert error error" });
            return res.json({ msg: "success" });
          }
        );
      } else {
        // Release the connection if no matching user found
        db.release();
        return res.json({ msg: "success" });
      }
    });
  });
});

// clearLogs
app.delete("/clearLogs", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "DELETE FROM tb_user_log";

    db.query(sql, (err, result) => {
      // Release the connection after executing the query
      db.release();

      if (err) return res.json({ msg: "delete error" });
      return res.json({ msg: "success" });
    });
  });
});

// avatar
app.get("/avatar", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const id = req.user.id;
    const sql = "SELECT avatar FROM tb_user WHERE id = ?";

    db.query(sql, [id], (err, result) => {
      // Release the connection after executing the query
      db.release();

      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// dashboard admin count
app.get("/adminCount", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT COUNT(id) as count FROM tb_user WHERE role = ?";
    const role = "Admin";

    db.query(sql, [role], (err, result) => {
      // Release the connection after executing the query
      db.release();

      if (err) return res.json({ error: "select count error" });
      return res.json(result);
    });
  });
});

// dashboard instructor count
app.get("/instructorCount", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT COUNT (id) as count FROM tb_user WHERE role = ?";
    const role = "Instructor";

    db.query(sql, [role], (err, result) => {
      db.release();

      if (err) return res.json({ error: "select count error" });
      return res.json(result);
    });
  });
});

// dashboard student count
app.get("/studentCount", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT COUNT (id) as count FROM tb_user WHERE role = ?";
    const role = "Student";

    db.query(sql, [role], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select count error" });
      return res.json(result);
    });
  });
});

// userData
app.get("/userData", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const sql =
      "SELECT fname, middlename, lname, gender, email, avatar FROM tb_user WHERE id = ?";

    db.query(sql, [userId], (err, result) => {
      db.release();

      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// updateData
app.put(
  '/updateData',
  verifyTokenMiddleware,
  (req, res) => {
    const { fname, middlename, lname, gender } = req.body;
    const userId = req.user.id;

    let avatar;

    if (!req.file) {
      if (gender === 'Male') {
        avatar = 'male.png';
      } else {
        avatar = 'female.png';
      }
    } else {
      // Upload file to Mega
      const fileStream = fs.createReadStream(req.file.path);
      const fileMetadata = {
        name: req.file.filename,
        size: req.file.size
      };

      client.upload({ name: req.file.filename, size: req.file.size, fileStream })
        .then((file) => {
          avatar = file.downloadId;
          // Remove the file from the local filesystem after upload
          fs.unlinkSync(req.file.path);
        })
        .catch((err) => {
          console.error('Error uploading file to Mega:', err);
          return res.status(500).json({ error: 'Internal server error' });
        });
    }

    const sql = 'UPDATE tb_user SET fname = ?, middlename = ?, lname = ?, gender = ?, avatar = ? WHERE id = ?';

    pool.getConnection((err, db) => {
      if (err) {
        console.error('Error getting database connection: ' + err.message);
        return res.status(500).json({ msg: 'Internal server error' });
      }

      db.query(
        sql,
        [fname, middlename, lname, gender, avatar, userId],
        (err, result) => {
          db.release();

          if (err) return res.status(500).json({ error: 'update error' });
          return res.json({ msg: 'updated' });
        }
      );
    });
  }
);

// getEmail
app.get("/getEmail", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;

    const sql = "SELECT id from tb_user WHERE id = ?";
    db.query(sql, [userId], (err, result) => {
      db.release();

      if (err) return res.json({ msg: "select error" });
      return res.json(result);
    });
  });
});

// updateEmail
app.put("/updateEmail/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { email, pass } = req.body;
    const id = req.params.id;

    const sql = "UPDATE tb_user SET email = ? WHERE pass = ? AND id = ?";

    db.query(sql, [email, pass, id], (err, result) => {
      db.release();
      if (err) return res.json({ error: "update error" });
      return res.json(result);
    });
  });
});

// changePassword
app.put("/changePassword", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { oldPass, newPass } = req.body;
    const id = req.user.id;

    const sql = "UPDATE tb_user SET pass = ? WHERE pass = ? AND id = ? ";
    db.query(sql, [newPass, oldPass, id], (err, result) => {
      db.release();
      if (err) return res.json({ error: "update error" });

      return res.json(result);
    });
  });
});

// userAdmin
app.get("/userAdmin", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "SELECT id, fname, middlename, lname, gender, email, pass, role FROM tb_user WHERE role = ?";
    const role = "Admin";

    db.query(sql, [role], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// userLog
app.get("/userLog", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT * FROM tb_user_log";

    db.query(sql, (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// userInstructor
app.get("/userInstructor", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "SELECT id, fname, middlename, lname, gender, email, pass, role FROM tb_user WHERE role = ?";
    const role = "Instructor";

    db.query(sql, [role], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// userStudent
app.get("/userStudent", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "SELECT id, fname, middlename, lname, gender, email, pass, role FROM tb_user WHERE role = ?";
    const role = "Student";

    db.query(sql, [role], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// addUser
app.post("/addUser", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "INSERT INTO tb_user (fname, middlename, lname, gender, email, pass, role) VALUES (?, ?, ?, ?, ?, ?, ?)";
    const { fname, middlename, lname, gender, email, pass, role } = req.body;

    db.query(
      sql,
      [fname, middlename, lname, gender, email, pass, role],
      (err, result) => {
        db.release();
        if (err) return res.json({ error: "insert error" });
        return res.json({ msg: "success" });
      }
    );
  });
});

// userDelete
app.delete("/userDelete/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const id = req.params.id;

    const sql1 = "SELECT role FROM tb_user WHERE id = ?";
    db.query(sql1, [id], (err1, result1) => {
      if (err1) {
        db.release();
        return res.json({ msg: "select error" });
      }

      if (result1.length > 0) {
        if (result1[0].role === "Instructor" || result1[0].role === "Admin") {
          const query2 = "DELETE FROM tb_class WHERE user_id = ?";

          db.query(query2, [id], (err2, result2) => {
            if (err2) {
              db.release();
              return res.json({ msg: "delete error" });
            }
          });

          const sql3 = "DELETE FROM tb_user WHERE id = ?";

          db.query(sql3, [id], (err3, result3) => {
            db.release();
            if (err3) return res.json({ error: "delete error" });

            return res.json({ msg: "success" });
          });
        } else if (result1[0].role === "Student") {
          const sql4 = "DELETE FROM tb_joinclass WHERE user_id = ?";

          db.query(sql4, [id], (err4, result4) => {
            if (err4) {
              db.release();
              return res.json({ msg: "delete error" });
            }
          });

          const sql5 = "DELETE FROM tb_user WHERE id = ?";

          db.query(sql5, [id], (err5, result5) => {
            db.release();

            if (err5) return res.json({ error: "delete error" });
            return res.json({ msg: "success" });
          });
        }
      }
    });
  });
});

// getUser
app.get("/getUser/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "SELECT fname, middlename, lname, gender, email, pass, role FROM tb_user WHERE id = ?";
    const id = req.params.id;

    db.query(sql, [id], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// updateUser
app.put("/updateUser/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "UPDATE tb_user SET fname = ?, middlename = ?, lname = ?, gender = ?, email = ?, pass = ?, role = ? WHERE id = ?";

    const { fname, middlename, lname, gender, email, pass, role } = req.body;
    const id = req.params.id;

    db.query(
      sql,
      [fname, middlename, lname, gender, email, pass, role, id],
      (err, result) => {
        db.release();
        if (err) return res.json({ error: "update error" });
        return res.json({ msg: "Update success" });
      }
    );
  });
});

// createClass
app.post("/createClass", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { classname, room, subject, code, schedule } = req.body;
    const specialCode = crypto.randomBytes(6).toString("base64");

    const userId = req.user.id;
    const sql =
      "INSERT INTO tb_class (user_id, special_code, classname, room, subject, code, schedule, is_archive) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

    db.query(
      sql,
      [userId, specialCode, classname, room, subject, code, schedule, "No"],
      (err, result) => {
        db.release();
        if (err) return res.json({ error: "insert error" });
        return res.json({ msg: "success" });
      }
    );
  });
});

// getClass
app.get("/getClass", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const sql = "SELECT * FROM `tb_class` WHERE user_id = ? AND is_archive = ?";

    db.query(sql, [userId, "No"], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// archiveClass
app.put("/archiveClass/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;

    const sql = "UPDATE tb_class SET is_archive = ? WHERE id = ?";

    db.query(sql, ["Yes", classId], (err, result) => {
      db.release();
      if (err) return res.json({ error: "update error" });
      return res.json({ msg: "success" });
    });
  });
});

// getArchivedClasses
app.get("/getArchivedClasses", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const sql = "SELECT * FROM `tb_class` WHERE user_id = ? AND is_archive = ?";

    db.query(sql, [userId, "Yes"], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// unarchiveClass
app.put("/unarchiveClass/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;

    const sql = "UPDATE tb_class SET is_archive = ? WHERE id = ?";

    db.query(sql, ["No", classId], (err, result) => {
      db.release();
      if (err) return res.json({ error: "update error" });
      return res.json({ msg: "success" });
    });
  });
});

// deleteClass
app.delete("/deleteClass/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "DELETE FROM tb_class WHERE id = ?";
    const classId = req.params.id;

    db.query(sql, [classId], (err1, result) => {
      if (err1) {
        db.release();
        return res.json({ error: "delete error" });
      }
      const sql2 = "DELETE FROM tb_joinclass WHERE class_id = ?";

      db.query(sql2, [classId], (err2, result2) => {
        if (err2) {
          db.release();
          return res.json({ msg: "delete error" });
        }

        const sql3 = "DELETE FROM `tb_contents` WHERE `class_id` = ?";
        db.query(sql3, [classId], (err3, result) => {
          if (err3) {
            db.release();
            return res.json({ msg: "delete error" });
          }

          const sql4 = "DELETE FROM `tb_exercise` WHERE `class_id` = ?";
          db.query(sql4, [classId], (err4, result) => {
            if (err4) {
              db.release();
              return res.json({ msg: "delete error" });
            }

            const sql5 = "DELETE FROM `tb_comment` WHERE `class_id` = ?";
            db.query(sql5, [classId], (err5, result) => {
              db.release();
              if (err5) return res.json({ msg: "delete error" });

              return res.json({ msg: "success" });
            });
          });
        });
      });
    });
  });
});

// leaveClass
app.delete("/leaveClass/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;
    const userId = req.user.id;

    const sql = "DELETE FROM tb_joinclass WHERE class_id = ? AND user_id = ?";
    db.query(sql, [classId, userId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "delete error" });
      return res.json({ msg: "success" });
    });
  });
});

// getEditClass
app.get("/getEditClass/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "SELECT classname, room, subject, code, schedule FROM tb_class WHERE id = ?";
    const id = req.params.id;

    db.query(sql, [id], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// editClass
app.put("/editClass/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "UPDATE tb_class SET classname = ?, room = ?, subject = ?, code = ?, schedule = ? WHERE id = ?";

    const { classname, room, subject, code, schedule } = req.body;
    const id = req.params.id;

    db.query(
      sql,
      [classname, room, subject, code, schedule, id],
      (err, result) => {
        db.release();
        if (err) return res.json({ error: "update error" });
        return res.json(result);
      }
    );
  });
});

// newPost
app.post(
  "/newPost/:id",
  verifyTokenMiddleware,
  upload.single("file"),
  (req, res) => {
    pool.getConnection((err, db) => {
      if (err) {
        console.error("Error getting database connection: " + err.message);
        return res.status(500).json({ msg: "Internal server error" });
      }

      const userId = req.user.id;

      const sql = "SELECT * FROM `tb_user` WHERE id = ?";
      db.query(sql, [userId], (err, result) => {
        if (err) {
          db.release();
          return res.json({ error: "select error" });
        }
        const sql =
          "INSERT INTO `tb_contents`(`class_id`, `user_id`, `fname`, `lname`, `avatar`, `title`, `post_date`, `file`, `file_type`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";

        let id = "";
        let fname = "";
        let lname = "";
        let avatar = "";
        let { title, date } = req.body;
        let class_id = req.params.id;

        if (result.length > 0) {
          id = result[0].id;
          fname = result[0].fname;
          lname = result[0].lname;
          avatar = result[0].avatar;
        }

        let file = null;
        let fileType = null;

        // Check if req.file exists (if a file was uploaded)
        if (req.file) {
          file = req.file.filename;

          fileType = path.extname(req.file.originalname);
        }
        db.query(
          sql,
          [class_id, id, fname, lname, avatar, title, date, file, fileType],
          (err1, result1) => {
            db.release();
            if (err1) return res.json({ error: "insert error" });
            return res.json({ msg: "success" });
          }
        );
      });
    });
  }
);

// checkClass
app.get("/checkClass/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const classId = req.params.id;

    const sql = "SELECT user_id FROM tb_class WHERE id = ?";
    db.query(sql, [classId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "select error" });

      if (result.length > 0) {
        if (result[0].user_id === userId) {
          return res.json({ msg: "matched" });
        } else {
          return res.json({ msg: "notmatch" });
        }
      } else {
        return res.json({ msg: "error" });
      }
    });
  });
});

// checkClass
app.get("/checkJoinedClass/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const classId = req.params.id;

    const sql = "SELECT user_id FROM tb_joinclass WHERE class_id = ?";
    db.query(sql, [classId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "select error" });

      const userJoinedClass = result.some((item) => item.user_id === userId);
      if (userJoinedClass) {
        return res.json({ msg: "matched" });
      } else {
        return res.json({ msg: "notmatch" });
      }
    });
  });
});

// getAnnounce
app.get("/getAnnounce/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const classId = req.params.id;

    const sql = "SELECT * FROM tb_contents WHERE class_id = ? AND user_id = ?";
    db.query(sql, [classId, userId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "select error" });

      return res.json(result);
    });
  });
});

// studentGetAnnouncement
app.get("/studentGetAnnouncement/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;

    const sql = "SELECT * FROM tb_contents WHERE class_id = ?";
    db.query(sql, [classId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "select error" });

      return res.json(result);
    });
  });
});

// comment
app.post("/comment/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;
    const userId = req.user.id;
    const usersql = "SELECT * FROM `tb_user` WHERE id = ?";

    db.query(usersql, [userId], (err, result) => {
      if (err) {
        db.release();
        return res.json({ msg: "select error" });
      }

      const sql =
        "INSERT INTO `tb_comment`(`class_id`, `content_id`, `fname`, `lname`, `avatar`, `comment`) VALUES (?, ?, ?, ?, ?, ?)";
      const { contentId, comment } = req.body;

      let fname = "";
      let lname = "";
      let avatar = "";

      if (result.length > 0) {
        fname = result[0].fname;
        lname = result[0].lname;
        avatar = result[0].avatar;
      }

      db.query(
        sql,
        [classId, contentId, fname, lname, avatar, comment],
        (err, result) => {
          db.release();
          if (err) return res.json({ error: "insert error" });
          return res.json({ msg: "success", result });
        }
      );
    });
  });
});

// commentCount
app.get("/commentCount/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "SELECT COUNT(id) as count FROM tb_comment WHERE content_id = ?";
    const contentId = req.params.id;

    db.query(sql, [contentId], (err, result) => {
      db.release();
      if (err) return res.json({ error: "insert error" });
      return res.json(result);
    });
  });
});

// classTitle
app.get("/classTitle/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT * FROM `tb_class` WHERE id = ?";
    const classId = req.params.id;

    db.query(sql, [classId], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// deletePost
app.delete("/deletePost/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "DELETE FROM `tb_contents` WHERE id = ?";
    const id = req.params.id;

    db.query(sql, [id], (err, result) => {
      db.release();
      if (err) return res.json({ error: "delete error" });
      return res.json({ msg: "deleted" });
    });
  });
});

// getPost
app.get("/getPost/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT * FROM `tb_contents` WHERE id = ?";
    const id = req.params.id;

    db.query(sql, [id], (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// updatePost
app.put("/updatePost/:pid", upload.single("file"), (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql =
      "UPDATE tb_contents SET title = ?, post_date = ?, file = ?, file_type = ? WHERE id = ?";
    const { title, date } = req.body;

    let file = null;
    let fileType = null;

    // Check if req.file exists (if a file was uploaded)
    if (req.file) {
      file = req.file.filename;
      fileType = path.extname(req.file.originalname);
    }
    const pid = req.params.pid;

    db.query(sql, [title, date, file, fileType, pid], (err, result) => {
      db.release();
      if (err) return res.json({ error: "update error" });
      return res.json({ msg: "success" });
    });
  });
});

// displayComment
app.get("/displayComment", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "SELECT * FROM `tb_comment`";

    db.query(sql, (err, result) => {
      db.release();
      if (err) return res.json({ error: "select error" });
      return res.json(result);
    });
  });
});

// commentDelete
app.delete("/commentDelete/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const sql = "DELETE FROM `tb_comment` WHERE id = ?";
    const id = req.params.id;

    db.query(sql, [id], (err, result) => {
      db.release();
      if (err) return res.json({ error: "delete error" });
      return res.json({ msg: "success" });
    });
  });
});

// createExercise
app.post(
  "/createExercise/:id",
  verifyTokenMiddleware,
  upload.single("file"),
  (req, res) => {
    pool.getConnection((err, db) => {
      if (err) {
        console.error("Error getting database connection: " + err.message);
        return res.status(500).json({ msg: "Internal server error" });
      }

      const userId = req.user.id;
      const classId = parseInt(req.params.id);
      const { time, points, note, exercise, description, questions, deadline } =
        req.body;
      const convertedTime = parseInt(time);
      const convertedPoints = parseInt(points);
      const convertedQuestions = JSON.stringify(questions);

      let file;
      let fileType;

      if (req.file) {
        file = req.file.filename;
        fileType = path.extname(req.file.originalname);
      }

      const sql =
        "INSERT INTO tb_exercise (class_id, user_id, time, points, note, exercise, description, questions, created_at, deadline, file, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)";

      if (exercise !== "" && points !== 0 && description !== "") {
        db.query(
          sql,
          [
            classId,
            userId,
            convertedTime,
            convertedPoints,
            note,
            exercise,
            description,
            convertedQuestions,
            deadline,
            file,
            fileType,
          ],
          (err, result) => {
            db.release();
            if (err) return res.json({ msg: "insert error" });

            return res.json({ msg: "success" });
          }
        );
      } else {
        return res.json({ msg: "failed" });
      }
    });
  }
);

// exercise
app.get("/exercise/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const classId = req.params.id;

    const sql =
      "SELECT * FROM `tb_exercise` WHERE class_id = ? AND user_id = ?";
    db.query(sql, [classId, userId], (err, result) => {
      if (err) {
        db.release();
        return res.json({ msg: "insert error" });
      }

      let exerciseList = [];

      const sql2 = "SELECT * FROM tb_exercisestatus WHERE exercise_id = ?";
      result.forEach((each) => {
        db.query(sql2, [each.id], (err2, result2) => {
          if (err) {
            db.release();
            return res.json({ msg: "select error" });
          }

          exerciseList.push({ exerciseItem: each, exerciseStatus: result2 });

          if (exerciseList.length === result.length) {
            db.release();
            return res.json(exerciseList);
          }
        });
      });
    });
  });
});

// homework
app.get("/homework/:hid", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const homeworkId = req.params.hid;

    const sql = "SELECT * FROM tb_exercise WHERE Id = ?";
    db.query(sql, [homeworkId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "select error" });
      return res.json(result);
    });
  });
});

// performTask
app.get("/performTask/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const taskId = req.params.id;

    const sql = "SELECT * FROM `tb_exercise` WHERE id = ?";
    db.query(sql, [taskId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "insert error" });
      return res.json(result);
    });
  });
});

// studentExercise
app.get("/studentExercise/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;
    const userId = req.user.id;

    const sql = "SELECT * FROM `tb_exercise` WHERE class_id = ?";
    db.query(sql, [classId], (err, result) => {
      if (err) {
        db.release(); // Release the connection in case of an error
        return res.json({ msg: "insert error" });
      }

      let exerciseList = [];

      const sql2 = "SELECT * FROM tb_exercisestatus WHERE exercise_id = ?";
      result.forEach((each) => {
        db.query(sql2, [each.id], (err2, result2) => {
          if (err2) {
            db.release(); // Release the connection in case of an error
            return res.json({ msg: "select error" });
          }

          const sql3 =
            "SELECT grade FROM tb_grade WHERE exercise_id = ? AND user_id = ?";
          db.query(sql3, [each.id, userId], (err3, result3) => {
            if (err3) {
              db.release(); // Release the connection in case of an error
              return res.json({ msg: "select error" });
            }

            const sql4 =
              "SELECT id as answer_id FROM tb_answers WHERE exercise_id = ? AND user_id = ?";
            db.query(sql4, [each.id, userId], (err4, result4) => {
              if (err4) {
                db.release(); // Release the connection in case of an error
                return res.json({ msg: "select error" });
              }

              let isStudentTaken = result4.length > 0;

              exerciseList.push({
                isStudentTaken: isStudentTaken,
                exerciseItem: each,
                exerciseStatus: result2,
                grade: result3,
              });

              if (exerciseList.length === result.length) {
                // All queries completed, send the response and release the connection
                res.json(exerciseList);
                db.release();
              }
            });
          });
        });
      });
    });
  });
});

// studentHomework
app.get("/studentHomework/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;
    const userId = req.user.id;

    const sql =
      "SELECT * FROM `tb_exercise` WHERE class_id = ? AND exercise = 'Assignment'";
    db.query(sql, [classId], (err, result) => {
      if (err) {
        db.release();
        return res.json({ msg: "insert error" });
      }

      let exerciseList = [];

      let counter = 0; // Counter to keep track of the number of queries executed

      result.forEach((each1) => {
        const sql1 =
          "SELECT grade FROM tb_grade WHERE exercise_id = ? AND user_id =?";

        db.query(sql1, [each1.id, userId], (err1, result1) => {
          if (err1) {
            db.release();
            return res.json({ msg: "select error" });
          }

          const sql2 =
            "SELECT id FROM tb_assignment_answer WHERE assignment_id = ? AND user_id = ?";

          db.query(sql2, [each1.id, userId], (err2, result2) => {
            if (err2) {
              db.release();
              return res.json({ msg: "select error" });
            }

            let answerSubmitted;
            let grade;

            if (result1.length > 0) {
              grade = result1[0].grade;
            }

            if (result2.length > 0) {
              answerSubmitted = true;
            } else {
              answerSubmitted = false;
            }

            exerciseList.push({
              exerciseItem: each1,
              grade: grade,
              answerSubmitted: answerSubmitted,
            });

            counter++; // Increment counter for each query

            // Check if all queries have been executed
            if (counter === result.length) {
              // Release the connection after all queries have been executed
              db.release();
              return res.json(exerciseList);
            }
          });
        });
      });
    });
  });
});

// delete exercise
app.delete("/deleteExercise/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const id = req.params.id;
    const sql = "DELETE FROM `tb_exercise` WHERE id = ?";

    db.query(sql, [id], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "delete error" });
      return res.json({ msg: "success" });
    });
  });
});

// joinClass
app.post("/joinClass", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const classCode = req.body.classCode;

    const sql =
      "SELECT id FROM tb_joinclass WHERE  classCode = ? AND user_id = ?";
    db.query(sql, [classCode, userId], (err, result) => {
      if (err) {
        db.release();
        return res.json({ msg: "select error" });
      }

      if (result.length <= 0) {
        const sql1 = "SELECT * FROM `tb_class` WHERE special_code = ?";
        db.query(sql1, [classCode], (err1, result1) => {
          if (err1) {
            db.release();
            return res.json({ msg: "select error" });
          }

          if (!(result1.length === 0)) {
            const sql2 =
              "INSERT INTO tb_joinclass (class_id, user_id, classCode) VALUES (?, ?, ?)";
            db.query(
              sql2,
              [result1[0].id, userId, classCode],
              (err2, result2) => {
                db.release();
                if (err2) return res.json({ msg: "insert error" });
                return res.json({ msg: "success" });
              }
            );
          } else {
            db.release();
            return res.json({ msg: "class doesn't exist." });
          }
        });
      } else {
        db.release();
        return res.json({ msg: "You have already joined to this class." });
      }
    });
  });
});

// joinedClass
app.get("/joinedClass", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const userId = req.user.id;
    const sql = "SELECT class_id FROM tb_joinclass WHERE user_id = ?";

    db.query(sql, [userId], (err, result) => {
      if (err) {
        db.release();
        return res.json({ msg: "select error" });
      }

      if (result.length === 0) {
        db.release();
        return res.json({ msg: "no class" });
      }

      const sql2 = "SELECT * FROM tb_class WHERE id = ? AND is_archive = ?";
      let classDetails = [];
      let processedCount = 0;

      result.forEach((each) => {
        db.query(sql2, [each.class_id, "No"], (err2, result2) => {
          if (err2) {
            db.release();
            return res.json({ msg: "select error" });
          }

          if (result2.length !== 0) {
            classDetails.push(result2[0]); // Assuming you want to push only the first row
          }

          processedCount++;

          if (processedCount === result.length) {
            // Release the connection after all queries have been executed
            db.release();
            if (classDetails.length > 0) {
              return res.json(classDetails);
            } else {
              return res.json([]);
            }
          }
        });
      });
    });
  });
});

// removeStudent
app.delete("/removeStudent/:classId/sid/:studentId", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.classId;
    const userId = req.params.studentId;

    const sql = "DELETE FROM tb_joinclass WHERE class_id = ? AND user_id = ?";
    db.query(sql, [classId, userId], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "delete error" });
      return res.json({ msg: "success" });
    });
  });
});

// classInstructor
app.get("/classInstructor/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;

    const sql1 = "SELECT user_id FROM tb_class WHERE id = ?";
    db.query(sql1, [classId], (err, result1) => {
      if (err) {
        db.release();
        return res.json({ msg: "select error" });
      }

      if (result1.length > 0) {
        const sql2 = "SELECT fname, lname, avatar FROM tb_user WHERE id = ?";
        db.query(sql2, [result1[0].user_id], (err, result2) => {
          db.release();
          if (err) return res.json({ msg: "select error" });
          return res.json(result2);
        });
      } else {
        db.release();
        return res.json({ msg: "no user_id" });
      }
    });
  });
});

// classStudent
app.get("/classStudent/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const classId = req.params.id;

    const sql1 = "SELECT user_id, joined FROM tb_joinclass WHERE class_id = ?";
    db.query(sql1, [classId], (err, result1) => {
      if (err) {
        db.release();
        return res.json({ msg: "select error" });
      }

      let studentInformation = [];

      let counter = 0; // Counter to keep track of the number of queries executed

      result1.forEach((each) => {
        const sql2 =
          "SELECT id, fname, lname, avatar FROM tb_user WHERE id = ?";
        db.query(sql2, [each.user_id], (err, result2) => {
          counter++; // Increment counter for each query

          if (err) {
            db.release();
            return res.json({ msg: "select error" });
          }

          const studentInfo = {
            id: "",
            fname: "",
            lname: "",
            avatar: "",
            joined: "",
          };

          if (result2.length > 0) {
            studentInfo.id = result2[0].id;
            studentInfo.fname = result2[0].fname;
            studentInfo.lname = result2[0].lname;
            studentInfo.avatar = result2[0].avatar;
            studentInfo.joined = each.joined;
          }

          studentInformation.push(studentInfo);

          // Check if all queries have been executed
          if (counter === result1.length) {
            // Release the connection after all queries have been executed
            db.release();
            return res.json(studentInformation);
          }
        });
      });
    });
  });
});

// taskAnswer
app.post("/taskAnswer/:id", verifyTokenMiddleware, (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const exerciseId = req.params.id;
    const userId = req.user.id;
    const allAnswers = req.body;
    const stringAllAnswers = JSON.stringify(allAnswers);

    const sql =
      "INSERT INTO tb_answers (exercise_id, user_id, answer) VALUES (?, ?, ?)";
    db.query(sql, [exerciseId, userId, stringAllAnswers], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "select error" });
      return res.json({ msg: "success" });
    });
  });
});

// studentTakenTask
app.get("/studentTakenTask/:id", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const exerciseId = req.params.id;

    const sql1 = "SELECT user_id FROM tb_answers WHERE exercise_id = ?";
    db.query(sql1, [exerciseId], (err, result1) => {
      if (err) {
        db.release();
        return res.json({ msg: "select error" });
      }

      const studentInfoList = [];

      let counter = 0; // Counter to keep track of the number of queries executed

      result1.forEach((each) => {
        let totalScore = 0;

        const sql3 =
          "SELECT answer FROM tb_answers WHERE user_id = ? AND exercise_id = ?";
        db.query(sql3, [each.user_id, exerciseId], (err3, result3) => {
          if (err3) {
            db.release();
            return res.json({ msg: "select error 3" });
          }

          const sql4 = "SELECT questions FROM tb_exercise WHERE id = ?";
          db.query(sql4, [exerciseId], (err4, result4) => {
            if (err4) {
              db.release();
              return res.json({ msg: "select error 2" });
            }

            const formattedStudentAnswer = JSON.parse(result3[0].answer);
            const formattedCorrectAnswer = JSON.parse(result4[0].questions);
            const sortedFormattedStudentAnswer = formattedStudentAnswer.sort(
              (a, b) => {
                return a.number - b.number;
              }
            );

            for (let i = 0; i < formattedCorrectAnswer.length; i++) {
              if (
                sortedFormattedStudentAnswer[i].number ===
                Number(formattedCorrectAnswer[i].number)
              ) {
                const removeSpaceSortedFormattedStudentAnswer =
                  sortedFormattedStudentAnswer[i].answer.replace(/\s/g, "");
                const lowerCaseRemoveSpaceSortedFormattedStudentAnswer =
                  removeSpaceSortedFormattedStudentAnswer.toLowerCase();

                const removeSpaceformattedCorrectAnswer =
                  formattedCorrectAnswer[i].correctAnswer.replace(/\s/g, "");
                const lowerCaseRemoveSpaceformattedCorrectAnswer =
                  removeSpaceformattedCorrectAnswer.toLowerCase();

                if (
                  lowerCaseRemoveSpaceSortedFormattedStudentAnswer ===
                  lowerCaseRemoveSpaceformattedCorrectAnswer
                ) {
                  totalScore += 1;
                }
              }
            }

            let studentGrade = 0;

            const sql6 =
              "SELECT grade from tb_grade WHERE user_id = ? AND exercise_id = ?";
            db.query(sql6, [each.user_id, exerciseId], (err6, result6) => {
              if (err6) {
                db.release();
                return res.json({ msg: "select error" });
              }
              if (result6.length > 0) {
                studentGrade = result6[0];
              }
            });

            const sql2 =
              "SELECT id, fname, lname, avatar FROM tb_user WHERE id = ?";
            db.query(sql2, [each.user_id], (err, result2) => {
              counter++; // Increment counter for each query

              if (err) {
                db.release();
                return res.json({ msg: "select error" });
              }

              let student = "";

              if (result2.length > 0) {
                student = result2[0];
              }

              studentInfoList.push({
                student: student,
                totalScore,
                over: formattedCorrectAnswer.length,
                studentGrade,
              });

              // Check if all queries have been executed
              if (counter === result1.length) {
                // Release the connection after all queries have been executed
                db.release();
                return res.json(studentInfoList);
              }
            });
          });
        });
      });
    });
  });
});

// studentAnswer
app.get("/answer/:aid/student/:sid", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const exerciseId = req.params.aid;
    const studentId = req.params.sid;

    const sql = "SELECT fname, lname FROM tb_user WHERE id = ?";
    db.query(sql, [studentId], (err, result) => {
      if (err) {
        db.release();
        return res.json({ msg: "select error" });
      }

      const studentName = {
        fname: "",
        lname: "",
      };

      if (result.length > 0) {
        studentName.fname = result[0].fname;
        studentName.lname = result[0].lname;
      }

      const sql1 =
        "SELECT answer FROM tb_answers WHERE user_id = ? AND exercise_id = ?";
      db.query(sql1, [studentId, exerciseId], (err1, result1) => {
        if (err1) {
          db.release();
          return res.json({ msg: "select error 1" });
        }

        const sql2 = "SELECT questions FROM tb_exercise WHERE id = ?";
        db.query(sql2, [exerciseId], (err2, result2) => {
          if (err2) {
            db.release();
            return res.json({ msg: "select error 2" });
          }

          let formattedStudentAnswer = "";
          let formattedCorrectAnswer = "";

          if (result1.length > 0 || result2.length > 0) {
            formattedStudentAnswer = JSON.parse(result1[0].answer);
            formattedCorrectAnswer = JSON.parse(result2[0].questions);
          }
          const sortedFormattedStudentAnswer = formattedStudentAnswer.sort(
            (a, b) => {
              return a.number - b.number;
            }
          );

          let totalScore = 0;
          for (let i = 0; i < formattedCorrectAnswer.length; i++) {
            if (
              sortedFormattedStudentAnswer[i].number ===
              Number(formattedCorrectAnswer[i].number)
            ) {
              const removeSpaceSortedFormattedStudentAnswer =
                sortedFormattedStudentAnswer[i].answer.replace(/\s/g, "");
              const lowerCaseRemoveSpaceSortedFormattedStudentAnswer =
                removeSpaceSortedFormattedStudentAnswer.toLowerCase();

              const removeSpaceformattedCorrectAnswer = formattedCorrectAnswer[
                i
              ].correctAnswer.replace(/\s/g, "");
              const lowerCaseRemoveSpaceformattedCorrectAnswer =
                removeSpaceformattedCorrectAnswer.toLowerCase();

              if (
                lowerCaseRemoveSpaceSortedFormattedStudentAnswer ===
                lowerCaseRemoveSpaceformattedCorrectAnswer
              ) {
                totalScore += 1;
              }

              if (
                sortedFormattedStudentAnswer[i].number ===
                formattedCorrectAnswer.length
              ) {
                const totalQuestions = formattedCorrectAnswer.length;
                db.release();
                return res.json({
                  studentName,
                  totalScore,
                  totalQuestions,
                  formattedCorrectAnswer,
                  sortedFormattedStudentAnswer,
                });
              }
            }
          }
        });
      });
    });
  });
});

// submitGrade
app.post("/submitGrade/:aid/student/:sid", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { studentGrade } = req.body;
    const { aid, sid } = req.params;

    const sql =
      "INSERT INTO tb_grade (exercise_id, user_id, grade) VALUES (?, ?, ?)";
    db.query(sql, [aid, sid, studentGrade], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "select error" });
      return res.json({ msg: "success" });
    });
  });
});

// closeExercise
app.post("/closeExercise/:eid", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { eid } = req.params;
    const status = "closed";

    const sql1 = "DELETE FROM tb_exercisestatus WHERE exercise_id = ?";
    db.query(sql1, [eid], (err1, result1) => {
      if (err1) {
        db.release();
        return res.json({ msg: "delete error" });
      }
      const sql =
        "INSERT INTO tb_exercisestatus (exercise_id, status) VALUES (?, ?)";

      db.query(sql, [eid, status], (err, result) => {
        db.release();

        if (err) return res.json({ msg: "select error" });
        return res.json({ msg: "success" });
      });
    });
  });
});

// openExercise
app.post("/openExercise/:eid", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { eid } = req.params;
    const status = "open";

    const sql1 = "DELETE FROM tb_exercisestatus WHERE exercise_id = ?";
    db.query(sql1, [eid], (err1, result1) => {
      if (err1) {
        db.release();
        return res.json({ msg: "delete error" });
      }
      const sql =
        "INSERT INTO tb_exercisestatus (exercise_id, status) VALUES (?, ?)";

      db.query(sql, [eid, status], (err, result) => {
        db.release();

        if (err) return res.json({ msg: "select error" });
        return res.json({ msg: "success" });
      });
    });
  });
});

// submitAnswer
app.post(
  "/submitAnswer/:hid",
  verifyTokenMiddleware,
  upload.single("file"),
  (req, res) => {
    pool.getConnection((err, db) => {
      if (err) {
        console.error("Error getting database connection: " + err.message);
        return res.status(500).json({ msg: "Internal server error" });
      }

      const homeworkId = req.params.hid;
      const userId = req.user.id;
      let assignmentFile;
      let assignmentFileType;
      const comment = req.body.comment;

      if (req.file) {
        assignmentFile = req.file.filename;
        assignmentFileType = path.extname(req.file.originalname);
      }

      const sql =
        "INSERT INTO `tb_assignment_answer`(`assignment_id`, `user_id`, `answer_file`, `answer_file_type`, `comment`, `date_submited`) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)";

      db.query(
        sql,
        [homeworkId, userId, assignmentFile, assignmentFileType, comment],
        (err, result) => {
          db.release();

          if (err) return res.json({ msg: "insert error" });
          return res.json({ msg: "success" });
        }
      );
    });
  }
);

// studentSubmitAssignment
app.get("/studentSubmitAssignment/:hid", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const homeworkId = req.params.hid;

    const sql1 = "SELECT * FROM tb_assignment_answer WHERE assignment_id = ?";
    db.query(sql1, [homeworkId], (err1, result1) => {
      if (err1) {
        db.release();
        return res.json({ msg: "select error" });
      }

      let studentAssignmentList = [];

      result1.forEach((each) => {
        const sql2 =
          "SELECT id, fname, lname, avatar FROM tb_user WHERE id = ?";
        const userId = each.user_id;

        db.query(sql2, [userId], (err2, result2) => {
          if (err2) {
            db.release();
            return res.json({ msg: "select error" });
          }

          const sql3 =
            "SELECT grade FROM tb_grade WHERE exercise_id = ? AND user_id = ?";
          db.query(sql3, [homeworkId, userId], (err3, result3) => {
            if (err3) {
              db.release();
              return res.json({ msg: "select error" });
            }

            if (result3.length > 0) {
              result3.forEach((grade) => {
                const studentAssignment = {
                  studentId: "",
                  fname: "",
                  lname: "",
                  avatar: "",
                  answerFile: each.answer_file,
                  answerFileType: each.answer_file_type,
                  comment: each.comment,
                  dateSubmitted: each.date_submited,
                  grade: grade.grade,
                };

                if (result2.length > 0) {
                  studentAssignment.studentId = result2[0].id;
                  studentAssignment.fname = result2[0].fname;
                  studentAssignment.lname = result2[0].lname;
                  studentAssignment.avatar = result2[0].avatar;
                }

                studentAssignmentList.push(studentAssignment);

                if (result1.length === studentAssignmentList.length) {
                  db.release();
                  return res.json(studentAssignmentList);
                }
              });
            } else {
              const studentAssignment = {
                studentId: "",
                fname: "",
                lname: "",
                avatar: "",
                answerFile: each.answer_file,
                answerFileType: each.answer_file_type,
                comment: each.comment,
                dateSubmitted: each.date_submited,
              };

              if (result2.length > 0) {
                studentAssignment.studentId = result2[0].id;
                studentAssignment.fname = result2[0].fname;
                studentAssignment.lname = result2[0].lname;
                studentAssignment.avatar = result2[0].avatar;
              }

              studentAssignmentList.push(studentAssignment);

              if (result1.length === studentAssignmentList.length) {
                db.release();
                return res.json(studentAssignmentList);
              }
            }
          });
        });
      });
    });
  });
});

// submitAssignmentGrade
app.post("/submitAssignmentGrade", (req, res) => {
  pool.getConnection((err, db) => {
    if (err) {
      console.error("Error getting database connection: " + err.message);
      return res.status(500).json({ msg: "Internal server error" });
    }

    const { aid, sid, grade } = req.body;

    const sql =
      "INSERT INTO tb_grade (exercise_id, user_id, grade) VALUES (?, ?, ?)";
    db.query(sql, [aid, sid, grade], (err, result) => {
      db.release();
      if (err) return res.json({ msg: "insert error" });
      return res.json({ msg: "success" });
    });
  });
});

app.listen(port, () => console.log(`Server is running on port: ${port}`));
