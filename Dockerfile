# Use the latest official Python image as a base image
FROM python:latest

# Set the working directory in the container to /app
WORKDIR /app

# Copy the requirements.txt file to the working directory
COPY requirements.txt ./

# Install pip and the Python dependencies listed in requirements.txt
RUN pip install --upgrade pip && \
    pip install -r requirements.txt

# Copy the rest of the application code to the working directory
COPY . .

# Specify the command to run the application
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:8000", "wrapped-fm:app"]