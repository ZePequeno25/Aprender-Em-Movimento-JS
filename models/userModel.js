const bcrypt = require('bcrypt');
const { db } = require('../utils/firebase');
const { collection, query, where, getDocs, setDoc, doc, getDoc } = require('firebase-admin/firestore');

const createUser = async (userData)=>{
    try{
        if(!db){
            throw new Error('Firebase não inicializado');
        }
        const {userId, ...data } = userData;
        await setDoc(doc(db, 'users', userId), data);

    }catch (error){
        throw new Error(`Erro ao criar usuário: ${error.message}`);
    }
};

const verifyUserCredentials = async (email, password) => {
    try{
        if(!db){
            throw new Error('Firebase db não inicializado');
        }
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('email', '==', email));
        const snapshot = await getDocs(q);

        if(snapshot.empty){
            return null;
        }

        const user = snapshot.docs[0].data();
        const passwordMatch = await bcrypt.compare(password, user.password);

        if(!passwordMatch){
            return null;
        }

        return user;

    }catch (error){
        throw new Error(`Erro ao verificar credenciais: ${error.message}`);
    }
};

module.exports = { createUser, verifyUserCredentials };
