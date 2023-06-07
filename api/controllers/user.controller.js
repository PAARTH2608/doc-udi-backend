const jwt = require("jsonwebtoken");
const { User, Appointment, Doc } = require("../models");
var CryptoJS = require("crypto-js");


require("dotenv").config();

// creating new user
const createUser = async (req, res) => {
  const medicalHistory = "";
  const { name, email, password, pfp } = req.body;
  const isNewUser = await User.isThisEmailInUse(email);
  if (!isNewUser)
    return res.json({
      success: false,
      message: "This email is already in use, try sign-in",
    });
  const user = await User({
    pfp,
    name,
    email,
    password,
    medicalHistory,
  });
  await user.save();
  res.json({ success: true, user });
};

// sign-in new user
const userSignIn = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user)
    return res.json({
      success: false,
      message: "user not found, with the given email!",
    });

  const isMatch = await user.comparePassword(password);
  if (!isMatch)
    return res.json({
      success: false,
      message: "email / password does not match!",
    });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });

  let oldTokens = user.tokens || [];

  if (oldTokens.length) {
    oldTokens = oldTokens.filter((t) => {
      const timeDiff = (Date.now() - parseInt(t.signedAt)) / 1000;
      if (timeDiff < 86400) {
        return t;
      }
    });
  }

  await User.findByIdAndUpdate(user._id, {
    tokens: [...oldTokens, { token, signedAt: Date.now().toString() }],
  });

  const userInfo = {
    fullname: user.name,
    email: user.email,
    pfp: user.pfp
  };
  const userID = user._id;

  res.json({ success: true, user: userInfo, id: userID, token });
};

// user sign-out
const signOut = async (req, res) => {
  if (req.headers && req.headers.authorization) {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authorization fail!" });
    }

    const tokens = req.user.tokens;

    const newTokens = tokens.filter((t) => t.token !== token);

    await User.findByIdAndUpdate(req.user._id, { tokens: newTokens });
    res.json({ success: true, message: "Sign out successfully!" });
  }
};

//book appointment
const bookAppointment = async (req, res) => {
  const { docPfp, patientPfp, docName, docID, specialization, patientName, patientID, date, time_slot, symptoms, address, fees } = req.body;
  const appointment = await Appointment({
    docPfp,
    patientPfp,
    docName, 
    docID, 
    specialization, 
    patientName, 
    patientID, 
    date, 
    time_slot,
    symptoms,
    address,
    fees
  });
  await appointment.save();
  res.json({ success: true, appointment });
  
}

//see previous appointments
//from User model
const previousAppointments = async (req, res) => {
  const id = req.body.patientID;
  User.findById(id, (err, prevAppointments) => {
    if(!prevAppointments || err){
      res.json({ success: false, message: "error in finding prev appointments" });
    }
    else{
      var bytes  = CryptoJS.AES.decrypt(prevAppointments.medicalHistory, 'secret key 123');
      var originalText = bytes.toString(CryptoJS.enc.Utf8);
      
      let medicalHistory = "";
      if(prevAppointments.medicalHistory !== ""){
        medicalHistory = JSON.parse(originalText);
      }

      res.json({ success: true, medicalHistory });
    }
  })
};

//see upcoming appointments
//from appointments model
const upcomingAppointments = async (req, res) => {
  const pid = req.body.id;
  await Appointment.find({ patientID: pid }, (err, upAppointments) => {
    if(upAppointments.length === 0 || err){
      res.json({ success: false, message: "error in finding upcoming appointments" });
    }
    else{
      res.json({ success: true, upAppointments });
    }
  })
};

//start an appointment
const startAppointment = async (req, res) => {
  const { docID, patientName, patientID, date, time_slot, symptoms, patientPfp } = req.body;
  let currentAppointment = []

  await Doc.findById(docID, (err, docData) => {
    if(!docData || err){
      res.json({ success: false, message: "error while finding doctor" });
      return;
    }
    else{
      currentAppointment = docData.currentAppointment;
    }
  });

  const newAppointment = {
    patientPfp,
    patientName,
    patientID,
    date,
    time_slot,
    symptoms
  };

  currentAppointment.push(newAppointment);

  await Doc.updateOne({ _id: docID }, { currentAppointment }, (err, upDoc) => {
    if(!upDoc || err){
      res.json({ success: false, message: "error while updating doctor's currentAppointment array" });
    }
  });
  
  res.json({ success: true, newAppointment });


};

const getDoctorBySpecialization = async (req, res) => {
  const specialization = req.body.specialization;
  await Doc.find({ specialization }, (err, docs) => {
    if(err){
      res.json({ success: false, message: "error in finding doctors" });
    }
    else{
      res.json({ success: true, docs });
    }
  });


};

//get all doctor list
const getAllDoctors = async (req, res) => {
  await Doc.find((err,docs)=>{
    if(err){
        res.json({ success: false, message: "error in finding doctors" });
    }
    else{
      res.json({ success: true, docs });
    }
  }); 
  
};

//return true if appointment ended else false
const endAppointment = async (req, res) => {
  const { patientID, date, time_slot } = req.body;
  await Appointment.findOne({ patientID, date, time_slot },(err, appointment) =>{
    if(err){
      res.json({ success: false, message: "error in getting appointment" });
    }
    else if(!appointment){
      res.json({ success: false });
    }
    else{
      res.json({ success: true });
    }
  });
}

//update user pfp
const updatePfp = async (req, res) => {
  const { id, pfp } = req.body;
  await User.findById(id, (err, user) => {
    if(!user || err){
      res.json({ success: false, messsage: "error in finding user" });
    }
  });

  await User.findByIdAndUpdate(id, { pfp }, (err, user) =>{
    if(err){
      res.json({ success: false, message: "error in updating user" });
    }
    else{
      res.json({ success: true, message: "pfp updated successfully", user });
    }
  })

}


module.exports = {
  createUser,
  userSignIn,
  signOut,
  bookAppointment,
  previousAppointments,
  upcomingAppointments,
  startAppointment,
  getDoctorBySpecialization,
  getAllDoctors,
  endAppointment,
  updatePfp
};
