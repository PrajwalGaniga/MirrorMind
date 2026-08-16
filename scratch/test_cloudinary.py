import os
import sys
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))
load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))

cloudinary.config(
    cloud_name="ss5gnsii",
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET")
)

with open("dummy.txt", "w") as f:
    f.write("test upload")

try:
    res = cloudinary.uploader.upload("dummy.txt", folder="mirrormind/test", resource_type="auto")
    print("SUCCESS! URL:", res.get("secure_url"))
except Exception as e:
    print("FAILED:", str(e))
finally:
    if os.path.exists("dummy.txt"):
        os.remove("dummy.txt")
