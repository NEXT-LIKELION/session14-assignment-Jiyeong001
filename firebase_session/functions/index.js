const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

function isValidName(name) {
  return !/[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(name);
}

function isValidEmail(email) {
  return email.includes("@");
}

exports.createUser = onRequest(async (req, res) => {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

  const { name, email } = req.body;

  if (!name || !email)
    return res.status(400).send("이름과 이메일을 모두 입력해주세요.");
  if (!isValidName(name))
    return res.status(400).send("이름에 한글이 포함되어 있으면 안 됩니다.");
  if (!isValidEmail(email))
    return res.status(400).send("올바른 이메일 형식이 아닙니다.");

  try {
    await db.collection("users").add({
      name,
      email,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.status(201).send("사용자가 성공적으로 등록되었습니다.");
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

exports.getUserByName = onRequest(async (req, res) => {
  if (req.method !== "GET") return res.status(405).send("Method Not Allowed");

  const name = req.query.name;
  if (!name) return res.status(400).send("조회할 이름을 쿼리로 입력해주세요.");

  try {
    const snapshot = await db
      .collection("users")
      .where("name", "==", name)
      .get();

    if (snapshot.empty)
      return res.status(404).send("해당 이름의 사용자를 찾을 수 없습니다.");

    const users = [];
    snapshot.forEach((doc) => users.push({ id: doc.id, ...doc.data() }));

    return res.status(200).send(users);
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

exports.updateEmail = onRequest(async (req, res) => {
  if (req.method !== "PUT") return res.status(405).send("Method Not Allowed");

  const { name, newEmail } = req.body;
  if (!name || !newEmail)
    return res.status(400).send("이름과 새 이메일을 모두 입력해주세요.");
  if (!isValidEmail(newEmail))
    return res.status(400).send("올바른 이메일 형식이 아닙니다.");

  try {
    const snapshot = await db
      .collection("users")
      .where("name", "==", name)
      .get();

    if (snapshot.empty)
      return res.status(404).send("해당 이름의 사용자를 찾을 수 없습니다.");

    const userDoc = snapshot.docs[0];
    await db.collection("users").doc(userDoc.id).update({ email: newEmail });

    return res.status(200).send("이메일이 성공적으로 수정되었습니다.");
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});

exports.deleteUser = onRequest(async (req, res) => {
  if (req.method !== "DELETE")
    return res.status(405).send("Method Not Allowed");

  const name = req.query.name;
  if (!name) return res.status(400).send("삭제할 이름을 쿼리로 입력해주세요.");

  try {
    const snapshot = await db
      .collection("users")
      .where("name", "==", name)
      .get();

    if (snapshot.empty)
      return res.status(404).send("해당 이름의 사용자를 찾을 수 없습니다.");

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    const createdAt = userData.createdAt.toDate();
    const now = new Date();
    const secondsSinceCreated = (now - createdAt) / 1000;

    if (secondsSinceCreated < 60) {
      return res
        .status(403)
        .send({ error: "가입 1분 이내에는 삭제할 수 없습니다." });
    }

    await db.collection("users").doc(userDoc.id).delete();
    return res.status(200).send("사용자가 성공적으로 삭제되었습니다.");
  } catch (error) {
    return res.status(500).send({ error: error.message });
  }
});
