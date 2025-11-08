from flask import Flask
from flask_cors import CORS
from routes import routes


def create_app():
    """Create and configure the Flask application."""
    app = Flask(__name__)
    # Enable CORS for all routes to allow requests from mobile app
    CORS(app, resources={r"/*": {"origins": "*"}})
    app.register_blueprint(routes)
    return app


if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, port=5000, host="0.0.0.0")