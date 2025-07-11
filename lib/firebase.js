// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDjn2vNWVx7hAUaXjet2Cc_dNgPEhJ5f78",
  authDomain: "fir-test-c3bbf.firebaseapp.com",
  databaseURL: "https://fir-test-c3bbf-default-rtdb.firebaseio.com",
  projectId: "fir-test-c3bbf",
  storageBucket: "fir-test-c3bbf.firebasestorage.app",
  messagingSenderId: "314661547246",
  appId: "1:314661547246:web:2c32b583d77078d94d57ff",
  measurementId: "G-33P4YY8S3L"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);