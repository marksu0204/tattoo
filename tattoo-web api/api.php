<?php
// api.php - InkFlow Backend

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Database config
$host = '68.183.232.114';
$db   = 'veyhabjkqt';
$user = 'veyhabjkqt';
$pass = 'xdj6ERrTTj';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB connection failed: ' . $e->getMessage()]);
    exit;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

try {
    switch ($action) {
        case 'getArtworks':
            // 先自動同步：檢查所有 PENDING/BOOKED 預約關聯的作品，確保狀態為 CLAIMED
            $syncClaimed = $pdo->query("SELECT DISTINCT artworkId FROM appointments WHERE artworkId IS NOT NULL AND artworkId != '' AND status IN ('PENDING', 'BOOKED')");
            $claimedIds = $syncClaimed->fetchAll(PDO::FETCH_COLUMN);
            
            if (!empty($claimedIds)) {
                // 將有預約的作品標記為 CLAIMED
                $placeholders = implode(',', array_fill(0, count($claimedIds), '?'));
                $updateClaimed = $pdo->prepare("UPDATE artworks SET status = 'CLAIMED' WHERE id IN ($placeholders)");
                $updateClaimed->execute($claimedIds);
                
                // 將沒有有效預約的作品標記為 AVAILABLE
                $updateAvailable = $pdo->prepare("UPDATE artworks SET status = 'AVAILABLE' WHERE id NOT IN ($placeholders)");
                $updateAvailable->execute($claimedIds);
            } else {
                // 如果沒有任何有效預約，所有作品都應該是 AVAILABLE
                $pdo->query("UPDATE artworks SET status = 'AVAILABLE'");
            }
            
            $stmt = $pdo->query("SELECT * FROM artworks ORDER BY createdAt DESC");
            $rows = $stmt->fetchAll();
            foreach($rows as &$row) {
                $row['tags'] = $row['tags'] ? explode(',', $row['tags']) : [];
                $row['price'] = (int)$row['price'];
                $row['specialPrice'] = $row['specialPrice'] ? (int)$row['specialPrice'] : null;
                $row['pngUrl'] = isset($row['pngUrl']) ? $row['pngUrl'] : null;
                $row['viewCount'] = isset($row['viewCount']) ? (int)$row['viewCount'] : 0;
            }
            echo json_encode($rows);
            break;

        case 'saveArtwork':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $check = $pdo->prepare("SELECT id FROM artworks WHERE id = ?");
            $check->execute([$input['id']]);
            $exists = $check->fetch();
            $tags = implode(',', $input['tags'] ?? []);
            $pngUrl = $input['pngUrl'] ?? null;
            
            if ($exists) {
                $sql = "UPDATE artworks SET title=?, description=?, imageUrl=?, pngUrl=?, category=?, status=?, price=?, specialPrice=?, tags=? WHERE id=?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$input['title'], $input['description'], $input['imageUrl'], $pngUrl, $input['category'], $input['status'], $input['price'], $input['specialPrice'] ?? null, $tags, $input['id']]);
            } else {
                $sql = "INSERT INTO artworks (id, title, description, imageUrl, pngUrl, category, status, price, specialPrice, tags, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$input['id'], $input['title'], $input['description'], $input['imageUrl'], $pngUrl, $input['category'], $input['status'], $input['price'], $input['specialPrice'] ?? null, $tags, $input['createdAt']]);
            }
            echo json_encode(['success' => true]);
            break;

        case 'deleteArtwork':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $stmt = $pdo->prepare("DELETE FROM artworks WHERE id = ?");
            $stmt->execute([$input['id']]);
            echo json_encode(['success' => true]);
            break;

        case 'recordView':
            // 記錄作品點擊次數
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $artworkId = $input['id'] ?? null;
            if (!$artworkId) throw new Exception("Missing artwork ID");
            
            // 更新點擊次數（如果欄位不存在會自動設為 1）
            $stmt = $pdo->prepare("UPDATE artworks SET viewCount = COALESCE(viewCount, 0) + 1 WHERE id = ?");
            $stmt->execute([$artworkId]);
            
            // 返回更新後的次數
            $getCount = $pdo->prepare("SELECT viewCount FROM artworks WHERE id = ?");
            $getCount->execute([$artworkId]);
            $result = $getCount->fetch();
            
            echo json_encode(['success' => true, 'viewCount' => $result ? (int)$result['viewCount'] : 0]);
            break;

        case 'getAppointments':
            $stmt = $pdo->query("SELECT * FROM appointments");
            $rows = $stmt->fetchAll();
            // 確保數字欄位正確轉換
            foreach($rows as &$row) {
                $row['totalPrice'] = isset($row['totalPrice']) && $row['totalPrice'] !== null ? (int)$row['totalPrice'] : null;
                $row['depositPaid'] = isset($row['depositPaid']) && $row['depositPaid'] !== null ? (int)$row['depositPaid'] : null;
            }
            echo json_encode($rows);
            break;

        case 'saveAppointment':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $check = $pdo->prepare("SELECT id, artworkId FROM appointments WHERE id = ?");
            $check->execute([$input['id']]);
            $existingApt = $check->fetch();
            
            if ($existingApt) {
                // 如果舊預約有關聯作品，但新的沒有或不同，先恢復舊作品狀態
                $oldArtworkId = $existingApt['artworkId'];
                $newArtworkId = $input['artworkId'] ?? null;
                if ($oldArtworkId && $oldArtworkId !== $newArtworkId) {
                    $updateOldArtwork = $pdo->prepare("UPDATE artworks SET status = 'AVAILABLE' WHERE id = ?");
                    $updateOldArtwork->execute([$oldArtworkId]);
                }
                
                $sql = "UPDATE appointments SET date=?, timeSlot=?, userId=?, customerName=?, status=?, notes=?, artworkId=?, artworkTitle=?, artworkImage=?, phoneNumber=?, totalPrice=?, depositPaid=?, tattooPosition=?, tattooSize=?, tattooColor=?, consentNotes=?, orderType=? WHERE id=?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $input['date'], 
                    $input['timeSlot'], 
                    $input['userId'] ?? null, 
                    $input['customerName'] ?? null, 
                    $input['status'], 
                    $input['notes'] ?? null, 
                    $input['artworkId'] ?? null, 
                    $input['artworkTitle'] ?? null, 
                    $input['artworkImage'] ?? null, 
                    $input['phoneNumber'] ?? null,
                    $input['totalPrice'] ?? null,
                    $input['depositPaid'] ?? null,
                    $input['tattooPosition'] ?? null,
                    $input['tattooSize'] ?? null,
                    $input['tattooColor'] ?? null,
                    $input['consentNotes'] ?? null,
                    $input['orderType'] ?? 'CLAIMED', // 預設為認領圖，保持向後兼容
                    $input['id']
                ]);
            } else {
                $sql = "INSERT INTO appointments (id, date, timeSlot, userId, customerName, status, notes, artworkId, artworkTitle, artworkImage, phoneNumber, totalPrice, depositPaid, tattooPosition, tattooSize, tattooColor, consentNotes, orderType) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    $input['id'], 
                    $input['date'], 
                    $input['timeSlot'], 
                    $input['userId'] ?? null, 
                    $input['customerName'] ?? null, 
                    $input['status'], 
                    $input['notes'] ?? null, 
                    $input['artworkId'] ?? null, 
                    $input['artworkTitle'] ?? null, 
                    $input['artworkImage'] ?? null, 
                    $input['phoneNumber'] ?? null,
                    $input['totalPrice'] ?? null,
                    $input['depositPaid'] ?? null,
                    $input['tattooPosition'] ?? null,
                    $input['tattooSize'] ?? null,
                    $input['tattooColor'] ?? null,
                    $input['consentNotes'] ?? null,
                    $input['orderType'] ?? 'CLAIMED' // 預設為認領圖，保持向後兼容
                ]);
            }
            
            // 如果預約有關聯作品，且狀態是 PENDING、WAITING_PAYMENT、SIGNING、SIGNED 或 BOOKED，更新作品為 CLAIMED
            $artworkId = $input['artworkId'] ?? null;
            $aptStatus = $input['status'] ?? '';
            if ($artworkId && in_array($aptStatus, ['PENDING', 'WAITING_PAYMENT', 'SIGNING', 'SIGNED', 'BOOKED'])) {
                $updateArtwork = $pdo->prepare("UPDATE artworks SET status = 'CLAIMED' WHERE id = ?");
                $updateArtwork->execute([$artworkId]);
            }
            // 如果預約狀態改為 OPEN 或 COMPLETED，且有關聯作品，恢復作品狀態
            if ($artworkId && in_array($aptStatus, ['OPEN', 'COMPLETED'])) {
                $updateArtwork = $pdo->prepare("UPDATE artworks SET status = 'AVAILABLE' WHERE id = ?");
                $updateArtwork->execute([$artworkId]);
            }
            
            echo json_encode(['success' => true]);
            break;

        case 'deleteAppointment':
        case 'cancelAppointment':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            
            // 先查詢預約是否有關聯作品
            $getApt = $pdo->prepare("SELECT artworkId FROM appointments WHERE id = ?");
            $getApt->execute([$input['id']]);
            $apt = $getApt->fetch();
            
            // 刪除預約
            $stmt = $pdo->prepare("DELETE FROM appointments WHERE id = ?");
            $stmt->execute([$input['id']]);
            
            // 如果有關聯作品，恢復作品狀態為 AVAILABLE
            if ($apt && !empty($apt['artworkId'])) {
                $updateArtwork = $pdo->prepare("UPDATE artworks SET status = 'AVAILABLE' WHERE id = ?");
                $updateArtwork->execute([$apt['artworkId']]);
            }
            
            echo json_encode(['success' => true]);
            break;

        case 'getCategories':
            $stmt = $pdo->query("SELECT name FROM categories");
            $cats = $stmt->fetchAll(PDO::FETCH_COLUMN);
            if (empty($cats)) $cats = ['All'];
            echo json_encode($cats);
            break;

        case 'addCategory':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $stmt = $pdo->prepare("INSERT IGNORE INTO categories (name) VALUES (?)");
            $stmt->execute([$input['name']]);
            $stmt = $pdo->query("SELECT name FROM categories");
            echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN));
            break;

        case 'deleteCategory':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $stmt = $pdo->prepare("DELETE FROM categories WHERE name = ?");
            $stmt->execute([$input['name']]);
            $stmt = $pdo->query("SELECT name FROM categories");
            echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN));
            break;

        case 'getAftercare':
            $stmt = $pdo->query("SELECT content FROM aftercare WHERE id = 1");
            $res = $stmt->fetch();
            echo json_encode(['content' => $res['content'] ?? '']);
            break;

        case 'saveAftercare':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $stmt = $pdo->prepare("INSERT INTO aftercare (id, content) VALUES (1, ?) ON DUPLICATE KEY UPDATE content = ?");
            $stmt->execute([$input['content'], $input['content']]);
            echo json_encode(['success' => true]);
            break;

        case 'syncUser':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $role = $input['role'] ?? 'MEMBER';
            
            // 先查詢現有用戶是否存在
            $checkStmt = $pdo->prepare("SELECT favorites FROM users WHERE id = ?");
            $checkStmt->execute([$input['id']]);
            $existingUser = $checkStmt->fetch();
            
            // 如果用戶已存在，保留資料庫中的收藏列表；否則使用輸入的收藏列表
            if ($existingUser) {
                // 用戶已存在，保留資料庫中的收藏列表（不更新）
                $favsJson = $existingUser['favorites'] ?? '[]';
                $sql = "UPDATE users SET name = ?, avatarUrl = ?, lastLogin = NOW() WHERE id = ?";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$input['name'], $input['avatarUrl'], $input['id']]);
            } else {
                // 新用戶，使用輸入的收藏列表
                $favsJson = isset($input['favorites']) ? json_encode($input['favorites']) : '[]';
                $sql = "INSERT INTO users (id, name, avatarUrl, role, favorites) VALUES (?, ?, ?, ?, ?)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([$input['id'], $input['name'], $input['avatarUrl'], $role, $favsJson]);
            }
            
            // 重新查詢以獲取最新的用戶數據（包含最新的收藏列表）
            $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
            $stmt->execute([$input['id']]);
            $user = $stmt->fetch();
            
            if ($user) {
                $user['favorites'] = json_decode($user['favorites'] ?? '[]');
                echo json_encode($user);
            } else {
                echo json_encode($input);
            }
            break;

        case 'getAllUsers':
            // 獲取所有用戶（排除管理員）
            $stmt = $pdo->query("SELECT * FROM users WHERE role != 'ADMIN' OR role IS NULL ORDER BY id DESC");
            $users = $stmt->fetchAll();
            foreach($users as &$user) {
                $favs = json_decode($user['favorites'] ?? '[]', true);
                $user['favorites'] = is_array($favs) ? $favs : [];
                $user['favoriteCount'] = count($user['favorites']);
            }
            echo json_encode($users);
            break;

        case 'toggleFavorite':
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            $userId = $input['userId'];
            $artId = $input['artworkId'];
            $stmt = $pdo->prepare("SELECT favorites FROM users WHERE id = ?");
            $stmt->execute([$userId]);
            $res = $stmt->fetch();
            $favs = $res ? json_decode($res['favorites'], true) : [];
            if (!$favs) $favs = [];
            if (in_array($artId, $favs)) {
                $favs = array_values(array_diff($favs, [$artId]));
            } else {
                $favs[] = $artId;
            }
            $stmt = $pdo->prepare("UPDATE users SET favorites = ? WHERE id = ?");
            $stmt->execute([json_encode($favs), $userId]);
            echo json_encode($favs);
            break;
            
        case 'getArtworkStats':
            $stmt = $pdo->query("SELECT favorites FROM users");
            $allRows = $stmt->fetchAll();
            $stats = [];
            foreach($allRows as $row) {
                $favs = json_decode($row['favorites'], true);
                if ($favs) {
                    foreach($favs as $artId) {
                        if (!isset($stats[$artId])) $stats[$artId] = 0;
                        $stats[$artId]++;
                    }
                }
            }
            echo json_encode($stats);
            break;

        // === 同意書相關 API ===
        
        case 'getConsent':
            // 公開 API - 根據預約 ID 獲取同意書資料
            $aptId = $_GET['id'] ?? null;
            if (!$aptId) throw new Exception("Missing appointment ID");
            
            $stmt = $pdo->prepare("SELECT * FROM appointments WHERE id = ?");
            $stmt->execute([$aptId]);
            $apt = $stmt->fetch();
            
            if (!$apt) {
                echo json_encode(['error' => 'Appointment not found']);
                break;
            }
            
            // 轉換數字欄位
            $apt['totalPrice'] = isset($apt['totalPrice']) ? (int)$apt['totalPrice'] : null;
            $apt['depositPaid'] = isset($apt['depositPaid']) ? (int)$apt['depositPaid'] : null;
            
            echo json_encode($apt);
            break;

        case 'saveConsent':
            // 保存客人簽名
            if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception("Method not allowed");
            
            $aptId = $input['id'] ?? null;
            if (!$aptId) throw new Exception("Missing appointment ID");
            
            // 驗證預約存在
            $check = $pdo->prepare("SELECT id FROM appointments WHERE id = ?");
            $check->execute([$aptId]);
            if (!$check->fetch()) throw new Exception("Appointment not found");
            
            // 更新簽名資料
            $sql = "UPDATE appointments SET signerName=?, signerPhone=?, signatureData=?, signedAt=? WHERE id=?";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([
                $input['signerName'] ?? null,
                $input['signerPhone'] ?? null,
                $input['signatureData'] ?? null,
                date('Y-m-d H:i:s'), // 當前時間
                $aptId
            ]);
            
            echo json_encode(['success' => true]);
            break;

        default:
            echo json_encode(['error' => 'Invalid action']);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
